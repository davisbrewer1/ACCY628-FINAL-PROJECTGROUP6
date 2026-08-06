"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Search,
  Settings2,
  Shield,
  Wrench,
  Zap,
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
  groupArticlesByCategory,
  isKnowledgeBaseUnavailable,
  KNOWLEDGE_BASE_CATEGORIES,
  readBookmarkedArticleIds,
  resetKnowledgeBaseAvailability,
  writeBookmarkedArticleIds,
} from "@/lib/knowledge-base";
import { createClient } from "@/lib/supabase/client";
import type { KnowledgeBaseArticle } from "@/lib/types";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Service Procedures": ClipboardList,
  "Troubleshooting Guides": Wrench,
  "Tools & Software": Settings2,
  "Standards & Policies": Shield,
  "Templates & Forms": FileText,
  "Quick Access": Zap,
};

let articlesCache: KnowledgeBaseArticle[] | null = null;

interface KnowledgeBasePanelProps {
  canEdit?: boolean;
  variant?: "default" | "tech";
}

export function KnowledgeBasePanel({
  canEdit,
  variant = "default",
}: KnowledgeBasePanelProps) {
  const tech = variant === "tech";
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const allowEdit =
    canEdit ??
    (activeRole === "administrator" || activeRole === "service_manager");

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>(
    articlesCache ?? [],
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>("Quick Access");
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState<string>(
    KNOWLEDGE_BASE_CATEGORIES[0],
  );
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

  const grouped = useMemo(
    () => groupArticlesByCategory(filtered),
    [filtered],
  );

  const activeCategoryLabel = category ?? "All categories";
  const activeCategoryCount = filtered.length;

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
      setUnavailable(isKnowledgeBaseUnavailable());
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setBookmarkedIds(readBookmarkedArticleIds());
  }, []);

  useEffect(() => {
    if (!open) return;
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

  function selectCategory(next: string | null) {
    setCategory(next);
    setBookmarksOnly(false);
    setSelectedId(null);
    setEditing(false);
    setCollapsed(new Set());
  }

  function toggleBookmark(articleId: string) {
    setBookmarkedIds((current) => {
      const next = new Set(current);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      writeBookmarkedArticleIds(next);
      return next;
    });
  }

  function toggleCollapsed(name: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
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
    if (!selected || selected.id.startsWith("seed-")) {
      showToast("Seed articles are read-only until synced to Supabase.", "error");
      return;
    }
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

  const triggerClass = tech
    ? "btn btn-sm gap-2 border-slate-600 bg-slate-900 text-slate-100 hover:border-cyan-500/50"
    : "btn btn-ghost btn-sm gap-2";
  const shell = tech
    ? "border-cyan-500/25 bg-slate-950 text-slate-100"
    : "border-base-300 bg-base-100";
  const muted = tech ? "text-slate-400" : "text-base-content/60";
  const chipIdle = tech ? "btn-ghost text-slate-200" : "btn-ghost";
  const rowHover = tech ? "hover:bg-slate-900/90" : "hover:bg-base-200/70";
  const card = tech
    ? "rounded-lg border border-slate-700 bg-slate-900/70"
    : "rounded-box border border-base-300 bg-base-100";

  function renderArticleRow(article: KnowledgeBaseArticle) {
    const bookmarked = bookmarkedIds.has(article.id);
    return (
      <li key={article.id} className="flex items-start gap-1 px-2 py-2">
        <button
          type="button"
          className={`min-w-0 flex-1 rounded-md px-1.5 py-1 text-left ${rowHover}`}
          onClick={() => openArticle(article)}
        >
          <p className="text-sm font-semibold leading-snug">{article.title}</p>
          <p className={`mt-0.5 line-clamp-2 text-xs ${muted}`}>
            {getArticleDescription(article.content)}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(article.tags ?? []).slice(0, 4).map((tag) => (
              <span
                key={tag}
                className={`badge badge-xs border-0 ${
                  tech ? "bg-slate-800 text-slate-300" : "badge-ghost"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs btn-square ${
            bookmarked ? (tech ? "text-cyan-300" : "text-secondary") : ""
          }`}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark article"}
          onClick={() => toggleBookmark(article.id)}
        >
          <Bookmark
            className={`size-3.5 ${bookmarked ? "fill-current" : ""}`}
          />
        </button>
      </li>
    );
  }

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={() => {
          setOpen(true);
          setLoading(true);
        }}
      >
        <BookOpen className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Knowledge Base</span>
      </button>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex justify-end">
          <button
            type="button"
            className={`absolute inset-0 ${tech ? "bg-slate-950/70" : "bg-base-content/40"}`}
            aria-label="Close knowledge base"
            onClick={() => {
              setOpen(false);
              setSelectedId(null);
              setEditing(false);
            }}
          />

          <aside
            className={`relative flex h-full w-full max-w-lg flex-col border-l shadow-2xl ${shell}`}
          >
            <div
              className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${
                tech ? "border-cyan-500/15" : "border-base-300"
              }`}
            >
              <div>
                <p className="text-base font-semibold">Knowledge Base</p>
                <p className={`text-xs ${muted}`}>
                  Click a tab, then open a process
                </p>
              </div>
              <button
                type="button"
                className={`btn btn-ghost btn-sm btn-square ${tech ? "text-slate-300" : ""}`}
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

            <div
              className={`space-y-2 border-b px-4 py-3 ${
                tech ? "border-cyan-500/15" : "border-base-300"
              }`}
            >
              <label
                className={`input input-sm input-bordered flex items-center gap-2 ${
                  tech ? "border-slate-700 bg-slate-900" : ""
                }`}
              >
                <Search className="size-3.5 opacity-60" aria-hidden="true" />
                <input
                  type="search"
                  className="grow bg-transparent text-sm"
                  placeholder="Search titles, tags, keywords…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>

              <div
                className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
                role="tablist"
                aria-label="Knowledge Base categories"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={category == null && !bookmarksOnly}
                  className={`btn btn-xs shrink-0 ${
                    category == null && !bookmarksOnly ? "btn-primary" : chipIdle
                  }`}
                  onClick={() => selectCategory(null)}
                >
                  All
                </button>
                {KNOWLEDGE_BASE_CATEGORIES.map((item) => {
                  const Icon = CATEGORY_ICONS[item] ?? BookOpen;
                  const selectedTab = category === item && !bookmarksOnly;
                  return (
                    <button
                      key={item}
                      type="button"
                      role="tab"
                      aria-selected={selectedTab}
                      className={`btn btn-xs shrink-0 gap-1 ${
                        selectedTab ? "btn-primary" : chipIdle
                      }`}
                      onClick={() => selectCategory(item)}
                    >
                      <Icon className="size-3" aria-hidden="true" />
                      {item}
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="tab"
                  aria-selected={bookmarksOnly}
                  className={`btn btn-xs shrink-0 gap-1 ${
                    bookmarksOnly ? "btn-secondary" : chipIdle
                  }`}
                  onClick={() => {
                    setBookmarksOnly(true);
                    setCategory(null);
                    setSelectedId(null);
                  }}
                >
                  <Bookmark className="size-3" aria-hidden="true" />
                  Bookmarks
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex justify-center py-14">
                  <span
                    className={`loading loading-spinner loading-md ${
                      tech ? "text-cyan-400" : "text-primary"
                    }`}
                  />
                </div>
              ) : unavailable && articles.length === 0 ? (
                <p className={`px-2 py-10 text-center text-sm ${muted}`}>
                  Knowledge Base is unavailable.
                </p>
              ) : filtered.length === 0 ? (
                <p className={`px-2 py-10 text-center text-sm ${muted}`}>
                  No articles match.
                </p>
              ) : category && !bookmarksOnly ? (
                <section className={card}>
                  <div
                    className={`flex items-center gap-2 border-b px-3 py-2 ${
                      tech ? "border-slate-800" : "border-base-200"
                    }`}
                  >
                    {(() => {
                      const Icon = CATEGORY_ICONS[category] ?? BookOpen;
                      return (
                        <Icon
                          className={`size-3.5 ${
                            tech ? "text-cyan-300" : "text-primary"
                          }`}
                        />
                      );
                    })()}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{activeCategoryLabel}</p>
                      <p className={`text-xs ${muted}`}>
                        {activeCategoryCount === 1
                          ? "1 process — click to open"
                          : `${activeCategoryCount} processes — click one to open`}
                      </p>
                    </div>
                  </div>
                  <ul
                    className={`divide-y ${
                      tech ? "divide-slate-800" : "divide-base-200"
                    }`}
                  >
                    {filtered.map((article) => renderArticleRow(article))}
                  </ul>
                </section>
              ) : (
                <div className="space-y-2">
                  {grouped.map((group) => {
                    const Icon = CATEGORY_ICONS[group.category] ?? BookOpen;
                    const isCollapsed = collapsed.has(group.category);
                    return (
                      <section key={group.category} className={card}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${rowHover}`}
                          onClick={() => {
                            if (isCollapsed) {
                              toggleCollapsed(group.category);
                            } else {
                              selectCategory(group.category);
                            }
                          }}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="size-3.5 opacity-70" />
                          ) : (
                            <ChevronDown className="size-3.5 opacity-70" />
                          )}
                          <Icon
                            className={`size-3.5 ${
                              tech ? "text-cyan-300" : "text-primary"
                            }`}
                          />
                          <span className="font-medium">{group.category}</span>
                          <span className={`ml-auto text-xs ${muted}`}>
                            {group.articles.length}
                          </span>
                        </button>

                        {!isCollapsed ? (
                          <ul
                            className={`divide-y border-t ${
                              tech
                                ? "divide-slate-800 border-slate-800"
                                : "divide-base-200 border-base-200"
                            }`}
                          >
                            {group.articles.map((article) =>
                              renderArticleRow(article),
                            )}
                          </ul>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {selected ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-8">
              <button
                type="button"
                className={`absolute inset-0 ${tech ? "bg-slate-950/80" : "bg-base-content/50"}`}
                aria-label="Close article"
                onClick={() => {
                  setSelectedId(null);
                  setEditing(false);
                }}
              />
              <div
                className={`relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl ${shell}`}
              >
                <div
                  className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${
                    tech ? "border-cyan-500/15" : "border-base-300"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-[11px] uppercase tracking-wide ${muted}`}>
                      {selected.category}
                    </p>
                    <h2 className="text-lg font-semibold leading-tight">
                      {editing ? "Edit article" : selected.title}
                    </h2>
                    <p className={`mt-0.5 text-xs ${muted}`}>
                      Updated {formatDate(selected.updated_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={`btn btn-ghost btn-sm btn-square ${
                        bookmarkedIds.has(selected.id)
                          ? tech
                            ? "text-cyan-300"
                            : "text-secondary"
                          : ""
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
                    {allowEdit && !selected.id.startsWith("seed-") ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditing((v) => !v)}
                      >
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

                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        className={`input input-bordered input-sm w-full ${
                          tech ? "border-slate-700 bg-slate-900" : ""
                        }`}
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          className={`select select-bordered select-sm w-full ${
                            tech ? "border-slate-700 bg-slate-900" : ""
                          }`}
                          value={draftCategory}
                          onChange={(e) => setDraftCategory(e.target.value)}
                        >
                          {KNOWLEDGE_BASE_CATEGORIES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <input
                          className={`input input-bordered input-sm w-full ${
                            tech ? "border-slate-700 bg-slate-900" : ""
                          }`}
                          value={draftTags}
                          onChange={(e) => setDraftTags(e.target.value)}
                          placeholder="Tags (comma separated)"
                        />
                      </div>
                      <textarea
                        className={`textarea textarea-bordered min-h-64 w-full font-mono text-xs ${
                          tech ? "border-slate-700 bg-slate-900" : ""
                        }`}
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={saving}
                        onClick={() => void handleSave()}
                      >
                        {saving ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          "Save"
                        )}
                      </button>
                    </div>
                  ) : (
                    <article
                      className={`space-y-2 text-sm leading-relaxed ${
                        tech ? "text-slate-200" : "text-base-content"
                      }`}
                    >
                      <ReactMarkdown
                        components={{
                          h2: ({ children }) => (
                            <h2 className="mt-3 text-sm font-semibold uppercase tracking-wide opacity-80">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="mt-2 text-sm font-semibold">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="opacity-90">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc space-y-0.5 pl-5">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal space-y-0.5 pl-5">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => <li>{children}</li>,
                          strong: ({ children }) => (
                            <strong className="font-semibold">{children}</strong>
                          ),
                          code: ({ children }) => (
                            <code
                              className={`rounded px-1 py-0.5 font-mono text-xs ${
                                tech ? "bg-slate-800" : "bg-base-200"
                              }`}
                            >
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {selected.content}
                      </ReactMarkdown>

                      {selected.category === "Quick Access" ? (
                        <div className="mt-4 space-y-1.5 border-t pt-3">
                          {[
                            "New User Onboarding Procedure",
                            "New User Checklist",
                            "Password Reset Procedure",
                            "Password Reset",
                            "Email Troubleshooting",
                            "Printer Offline",
                            "VPN Setup & Failures",
                            "MFA Issues",
                            "Ticket Handling Procedure",
                            "User Offboarding Procedure",
                            "Offboarding Checklist",
                          ].map((title) => {
                            const target = articles.find(
                              (article) => article.title === title,
                            );
                            if (!target) return null;
                            return (
                              <button
                                key={title}
                                type="button"
                                className={`btn btn-sm w-full justify-start ${
                                  tech
                                    ? "border-slate-700 bg-slate-900 text-slate-100"
                                    : "btn-ghost"
                                }`}
                                onClick={() => openArticle(target)}
                              >
                                {title}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </article>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
