import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseArticle, KnowledgeBaseCategory } from "@/lib/types";

export const KNOWLEDGE_BASE_CATEGORIES = [
  "Hardware",
  "Software",
  "Networking",
  "Security",
  "SOPs",
  "Repairs",
] as const satisfies readonly KnowledgeBaseCategory[];

const BOOKMARK_KEY = "nexus-kb-bookmarks";

let knowledgeBaseUnavailable = false;

export function isKnowledgeBaseUnavailable() {
  return knowledgeBaseUnavailable;
}

/** Clear the sticky "table missing" flag after migrations are applied. */
export function resetKnowledgeBaseAvailability() {
  knowledgeBaseUnavailable = false;
}

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

/** Fetch all knowledge base articles, newest updates first. */
export async function fetchKnowledgeBaseArticles(
  supabase: SupabaseClient,
): Promise<KnowledgeBaseArticle[]> {
  if (knowledgeBaseUnavailable) {
    return [];
  }

  const { data, error } = await supabase
    .from("knowledge_base_articles")
    .select("id, title, content, category, tags, updated_at, created_by, created_at")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      knowledgeBaseUnavailable = true;
    }
    throw error;
  }

  return ((data ?? []) as KnowledgeBaseArticle[]).map((article) => ({
    ...article,
    tags: article.tags ?? [],
  }));
}

export function filterKnowledgeBaseArticles(
  articles: KnowledgeBaseArticle[],
  options: {
    query?: string;
    category?: string | null;
    bookmarkedIds?: Set<string>;
    bookmarksOnly?: boolean;
  },
): KnowledgeBaseArticle[] {
  const query = options.query?.trim().toLowerCase() ?? "";
  const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

  return articles.filter((article) => {
    if (options.category && article.category !== options.category) {
      return false;
    }

    if (options.bookmarksOnly && options.bookmarkedIds && !options.bookmarkedIds.has(article.id)) {
      return false;
    }

    if (tokens.length === 0) {
      return true;
    }

    const haystack = [
      article.title,
      article.category,
      article.content,
      ...(article.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

export function getArticleDescription(content: string, maxLength = 140): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

export function readBookmarkedArticleIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeBookmarkedArticleIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...ids]));
}

export async function updateKnowledgeBaseArticle(
  supabase: SupabaseClient,
  articleId: string,
  input: {
    title: string;
    content: string;
    category: string;
    tags: string[];
  },
): Promise<KnowledgeBaseArticle> {
  const { data, error } = await supabase
    .from("knowledge_base_articles")
    .update({
      title: input.title,
      content: input.content,
      category: input.category,
      tags: input.tags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .select("id, title, content, category, tags, updated_at, created_by, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as KnowledgeBaseArticle;
}
