"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import { updateKnowledgeBaseArticle } from "@/lib/knowledge-base";
import { createClient } from "@/lib/supabase/server";

export async function saveKnowledgeBaseArticle(input: {
  articleId: string;
  title: string;
  content: string;
  category: string;
  tags: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const title = input.title.trim();
  const content = input.content.trim();
  const category = input.category.trim();
  const tags = input.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!title || !content || !category) {
    return { success: false, message: "Title, category, and content are required." };
  }

  try {
    await updateKnowledgeBaseArticle(supabase, input.articleId, {
      title,
      content,
      category,
      tags,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save article.";
    return { success: false, message };
  }

  revalidatePath("/technician");
  return { success: true, message: "Article updated." };
}
