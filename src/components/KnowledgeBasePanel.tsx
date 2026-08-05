"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bookmark,
  BookOpen,
  Monitor,
  Network,
  Pencil,
  Search,
  Shield,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { saveKnowledgeBaseArticle } from "@/app/actions/knowledge-base";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/format";
import {
  filterKnowledgeBaseArticles,
  fetchKnowledgeBaseArticles,
  getArticleDescription,
  isKnowledgeBaseUnavailable,
  KNOWLEDGE_BASE_CATEGORIES,
  readBookmarkedArticleIds,
  resetKnowledgeBaseAvailability,
  writeBookmarkedArticleIds,
} from "@/lib/knowledge-base";
import { createClient } from "@/lib/supabase/client";
import type { KnowledgeBaseArticle } from "@/lib/types";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Hardware: Monitor,
  Software: BookOpen,
  Networking: Network,
  Security: Shield,
  SOPs: BookOpen,
  Repairs: Wrench,
};

let articlesCache: KnowledgeBaseArticle[] | null = null;

interface KnowledgeBasePanelProps {
  canEdit?: boolean;
}

export function KnowledgeBasePanel({ canEdit }: KnowledgeBasePanelProps) {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const allowEdit =
    canEdit ??
    (activeRole === "administrator" || activeRole === "service_manager");

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>(
    articlesCache ?? [],
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState("Hardware");
  const [draftTags, setDraftTags] = useState("");
  const [draftContent, setDraftContent] = useState("");

  const selected = useMemo(
    () => articles.find((article) => article.id === selectedId) ?? null,
    [articles, selectedId],
  );

  const filtered = useMemo(
    () =>
      filterKnowledgeBaseArticles(articles, {
        query,
        category,
        bookmarkedIds,
        bookmarksOnly,
      }),
    [articles, query, category, bookmarkedIds, bookmarksOnly],
  );

  const loadArticles = useCallback(async (force = false) => {
    if (!force && articlesCache && articlesCache.length > 0) {
      setArticles(articlesCache);
      setUnavailable(false);
      return;
    }

    if (force) {
      resetKnowledgeBaseAvailability();
      articlesCache = null;
    }

    setLoading(true);
    const supabase = createClient();
    try {
      const rows = await fetchKnowledgeBaseArticles(supabase);
      articlesCache = rows;
      setArticles(rows);
      setUnavailable(false);
    } catch {
      setUnavailable(isKnowledgeBaseUnavailable() || true);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setBookmarkedIds(readBookmarkedArticleIds());
  }, []);

  useEffect(() => {
    if (!open) return;
    // Always try a fresh fetch when opening so a prior "table missing"
    // state does not stick after migrations are applied.
    void loadArticles(true);
  }, [open, loadArticles]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (selectedId) {
          setSelectedId(null);
          setEditing(false);
        } else {
          setOpen(false);
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, selectedId]);

  function toggleBookmark(articleId: string) {
    setBookmarkedIds((current) => {
      const next = new Set(current);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      writeBookmarkedArticleIds(next);
      return next;
    });
  }

  function openArticle(article: KnowledgeBaseArticle) {
    setSelectedId(article.id);
    setEditing(false);
    setDraftTitle(article.title);
    setDraftCategory(article.category);
    setDraftTags((article.tags ?? []).join(", "));
    setDraftContent(article.content);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const result = await saveKnowledgeBaseArticle({
      articleId: selected.id,
      title: draftTitle,
      content: draftContent,
      category: draftCategory,
      tags: draftTags,
    });
    setSaving(false);

    if (!result.success) {
      showToast(result.message, "error");
      return;
    }

    showToast(result.message);
    setEditing(false);
    articlesCache = null;
    await loadArticles(true);
    setSelectedId(selected.id);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm gap-2"
        onClick={() => setOpen(true)}
      >
        <BookOpen className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Knowledge Base</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-base-content/40"
            aria-label="Close knowledge base"
            onClick={() => {
              setOpen(false);
              setSelectedId(null);
              setEditing(false);
            }}
          />

          <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-base-300 bg-base-100 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-base-300 px-4 py-4">
              <div>
                <p className="text-lg font-semibold">Knowledge Base</p>
                <p className="text-xs text-base-content/60">
                  Technician SOPs and troubleshooting guides
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Close"
                onClick={() => {
                  setOpen(false);
                  setSelectedId(null);
                  setEditing(false);
                }}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 border-b border-base-300 px-4 py-3">
              <label className="input input-bordered flex items-center gap-2">
                <Search className="size-4 shrink-0 opacity-60" aria-hidden="true" />
                <input
                  type="search"
                  className="grow"
                  placeholder="Search title, tags, keywords…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn btn-xs ${category == null ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setCategory(null)}
                >
                  All
                </button>
                {KNOWLEDGE_BASE_CATEGORIES.map((item) => {
                  const Icon = CATEGORY_ICONS[item] ?? BookOpen;
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`btn btn-xs gap-1 ${
                        category === item ? "btn-primary" : "btn-ghost"
                      }`}
                      onClick={() =>
                        setCategory((current) => (current === item ? null : item))
                      }
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {item}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`btn btn-xs gap-1 ${
                    bookmarksOnly ? "btn-secondary" : "btn-ghost"
                  }`}
                  onClick={() => setBookmarksOnly((value) => !value)}
                >
                  <Bookmark className="size-3.5" aria-hidden="true" />
                  Bookmarks
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-16">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              ) : unavailable ? (
                <div className="px-4 py-10 text-center text-sm text-base-content/60">
                  Knowledge Base is unavailable until the{" "}
                  <code className="text-xs">knowledge_base_articles</code> table
                  is migrated in Supabase.
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-base-content/60">
                  No articles match your search.
                </div>
              ) : (
                <ul className="divide-y divide-base-300">
                  {filtered.map((article) => {
                    const Icon = CATEGORY_ICONS[article.category] ?? BookOpen;
                    const bookmarked = bookmarkedIds.has(article.id);
                    return (
                      <li key={article.id}>
                        <div className="flex items-start gap-2 px-3 py-3 hover:bg-base-200/60">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => openArticle(article)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-base-200 text-primary">
                                <Icon className="size-4" aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {article.title}
                                </p>
                                <p className="text-xs text-base-content/50">
                                  {article.category} · Updated{" "}
                                  {formatDate(article.updated_at)}
                                </p>
                              </div>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm text-base-content/70">
                              {getArticleDescription(article.content)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(article.tags ?? []).slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="badge badge-ghost badge-sm"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </button>
                          <button
                            type="button"
                            className={`btn btn-ghost btn-xs btn-square ${
                              bookmarked ? "text-secondary" : ""
                            }`}
                            aria-label={
                              bookmarked ? "Remove bookmark" : "Bookmark article"
                            }
                            onClick={() => toggleBookmark(article.id)}
                          >
                            <Bookmark
                              className={`size-4 ${bookmarked ? "fill-current" : ""}`}
                            />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {selected ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-8">
              <button
                type="button"
                className="absolute inset-0 bg-base-content/50"
                aria-label="Close article"
                onClick={() => {
                  setSelectedId(null);
                  setEditing(false);
                }}
              />
              <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-base-content/50">
                      {selected.category}
                    </p>
                    <h2 className="text-xl font-semibold leading-tight">
                      {editing ? "Edit article" : selected.title}
                    </h2>
                    <p className="mt-1 text-xs text-base-content/60">
                      Updated {formatDate(selected.updated_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={`btn btn-ghost btn-sm btn-square ${
                        bookmarkedIds.has(selected.id) ? "text-secondary" : ""
                      }`}
                      aria-label="Toggle bookmark"
                      onClick={() => toggleBookmark(selected.id)}
                    >
                      <Bookmark
                        className={`size-4 ${
                          bookmarkedIds.has(selected.id) ? "fill-current" : ""
                        }`}
                      />
                    </button>
                    {allowEdit ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm gap-1"
                        onClick={() => setEditing((value) => !value)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        {editing ? "Preview" : "Edit"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square"
                      aria-label="Close article"
                      onClick={() => {
                        setSelectedId(null);
                        setEditing(false);
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {editing ? (
                    <div className="space-y-3">
                      <input
                        className="input input-bordered w-full"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        placeholder="Title"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select
                          className="select select-bordered w-full"
                          value={draftCategory}
                          onChange={(event) =>
                            setDraftCategory(event.target.value)
                          }
                        >
                          {KNOWLEDGE_BASE_CATEGORIES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input input-bordered w-full"
                          value={draftTags}
                          onChange={(event) => setDraftTags(event.target.value)}
                          placeholder="Tags (comma separated)"
                        />
                      </div>
                      <textarea
                        className="textarea textarea-bordered min-h-72 w-full font-mono text-sm"
                        value={draftContent}
                        onChange={(event) => setDraftContent(event.target.value)}
                        placeholder="Markdown content"
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={() => void handleSave()}
                      >
                        {saving ? (
                          <span className="loading loading-spinner loading-sm" />
                        ) : (
                          "Save article"
                        )}
                      </button>
                    </div>
                  ) : (
                    <article className="space-y-3 text-sm leading-relaxed text-base-content">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-2xl font-bold tracking-tight">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="mt-4 text-xl font-semibold">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="mt-3 text-lg font-semibold">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => <p className="opacity-90">{children}</p>,
                          ul: ({ children }) => (
                            <ul className="list-disc space-y-1 pl-5">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
                          ),
                          li: ({ children }) => <li>{children}</li>,
                          strong: ({ children }) => (
                            <strong className="font-semibold">{children}</strong>
                          ),
                          code: ({ children }) => (
                            <code className="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="overflow-x-auto rounded-box bg-base-200 p-3 font-mono text-xs">
                              {children}
                            </pre>
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              className="link link-primary"
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {selected.content}
                      </ReactMarkdown>
                    </article>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
