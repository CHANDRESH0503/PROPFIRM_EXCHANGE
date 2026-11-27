"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Labelled, areaClass, inputClass } from "@/components/admin/action-form";
import { NativeSelect } from "@/components/ui/native-select";
import { saveArticle, saveChangelog } from "./actions";

const CATEGORIES = ["getting-started", "claims", "coins", "rewards", "journal", "account"] as const;
const STATUSES = ["draft", "published", "archived"] as const;

export type Article = {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  status: string;
};

function StatusSelect({ value }: { value?: string }) {
  const t = useTranslations("adminContent");
  return (
    <Labelled label={t("status")}>
      <NativeSelect name="status" defaultValue={value ?? "draft"} className="h-11">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`statuses.${s}`)}
          </option>
        ))}
      </NativeSelect>
    </Labelled>
  );
}

export function ArticleForm({ article }: { article?: Article }) {
  const t = useTranslations("adminContent");
  const h = useTranslations("help");
  return (
    <ActionForm
      action={saveArticle.bind(null, article?.id ?? null)}
      submit={t("save")}
      resetOnSuccess={!article}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Labelled label={t("titleField")}>
          <input
            name="title"
            defaultValue={article?.title}
            required
            minLength={3}
            maxLength={140}
            className={inputClass}
          />
        </Labelled>
        <Labelled label={t("slug")}>
          <input
            name="slug"
            defaultValue={article?.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={80}
            className={`${inputClass} font-mono`}
          />
        </Labelled>
        <Labelled label={t("category")}>
          <NativeSelect
            name="category"
            defaultValue={article?.category ?? "getting-started"}
            className="h-11"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {h(`categories.${c}`)}
              </option>
            ))}
          </NativeSelect>
        </Labelled>
        <StatusSelect value={article?.status} />
      </div>
      <Labelled label={t("summary")}>
        <input
          name="summary"
          defaultValue={article?.summary}
          required
          minLength={3}
          maxLength={300}
          className={inputClass}
        />
      </Labelled>
      <Labelled label={t("body")}>
        <textarea
          name="body"
          defaultValue={article?.body}
          required
          rows={10}
          maxLength={20000}
          className={areaClass}
        />
      </Labelled>
      <p className="text-xs text-muted-foreground">{t("bodyHint")}</p>
    </ActionForm>
  );
}

export function ChangelogForm({
  entry,
}: {
  entry?: { id: string; title: string; body: string; status: string };
}) {
  const t = useTranslations("adminContent");
  return (
    <ActionForm
      action={saveChangelog.bind(null, entry?.id ?? null)}
      submit={t("save")}
      resetOnSuccess={!entry}
    >
      <Labelled label={t("titleField")}>
        <input
          name="title"
          defaultValue={entry?.title}
          required
          minLength={3}
          maxLength={140}
          className={inputClass}
        />
      </Labelled>
      <Labelled label={t("body")}>
        <textarea
          name="body"
          defaultValue={entry?.body}
          required
          rows={5}
          maxLength={4000}
          className={areaClass}
        />
      </Labelled>
      <StatusSelect value={entry?.status} />
    </ActionForm>
  );
}
