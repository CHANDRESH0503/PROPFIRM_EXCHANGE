"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  archiveStrategy,
  createTag,
  deleteTag,
  saveStrategy,
  type JournalState,
} from "@/app/(app)/(shell)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Strategy, Tag } from "@/lib/journal/data";

const area =
  "w-full rounded-xl border border-hairline bg-ink-deep/60 px-4 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-danger";

export function StrategyForm({ strategy, onDone }: { strategy?: Strategy; onDone?: () => void }) {
  const t = useTranslations("journal");
  const [state, action, pending] = useActionState<JournalState, FormData>(
    saveStrategy.bind(null, strategy?.id ?? null),
    null,
  );
  const bad = (f: string) => state?.status === "error" && Boolean(state.fields?.includes(f));
  useEffect(() => {
    if (state?.status === "saved") {
      toast.success(t("strategiesPage.saved"));
      onDone?.();
    }
  }, [state, t, onDone]);
  const prefix = strategy?.id ?? "new";
  return (
    <form action={action} noValidate onReset={(e) => e.preventDefault()} className="space-y-4">
      <label className="block space-y-1.5 text-sm text-text-soft" htmlFor={`${prefix}-name`}>
        {t("strategiesPage.name")}
      </label>
      <Input
        id={`${prefix}-name`}
        name="name"
        defaultValue={strategy?.name}
        maxLength={80}
        required
        aria-invalid={bad("name") || undefined}
      />
      {bad("name") ? <p className="text-sm text-danger">{t("strategiesPage.duplicate")}</p> : null}
      <label className="block space-y-1.5 text-sm text-text-soft">
        <span>{t("strategiesPage.description")}</span>
        <textarea
          name="description"
          rows={2}
          maxLength={2000}
          defaultValue={strategy?.description ?? ""}
          className={area}
        />
      </label>
      <div className="space-y-1.5">
        <label htmlFor={`${prefix}-rules`} className="block text-sm text-text-soft">
          {t("strategiesPage.rules")}
        </label>
        <textarea
          id={`${prefix}-rules`}
          name="rules"
          rows={5}
          defaultValue={strategy?.rules.map((r) => r.body).join("\n") ?? ""}
          aria-invalid={bad("rules") || undefined}
          aria-describedby={`${prefix}-rules-hint`}
          className={area}
        />
        <p id={`${prefix}-rules-hint`} className="text-xs text-muted-foreground">
          {t("strategiesPage.rulesHint")}
        </p>
      </div>
      {state?.status === "error" && !state.fields?.includes("name") ? (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${state.code}`)}
        </p>
      ) : null}
      <Button type="submit" pending={pending}>
        {t("strategiesPage.save")}
      </Button>
    </form>
  );
}

export function StrategyItem({ strategy, rate }: { strategy: Strategy; rate: string | null }) {
  const t = useTranslations("journal.strategiesPage");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold">{strategy.name}</h3>
          {strategy.description ? (
            <p className="mt-1 text-sm text-text-soft">{strategy.description}</p>
          ) : null}
          {rate ? (
            <p className="mt-1 text-sm text-muted-foreground">{t("ruleFollowRate", { rate })}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
          >
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            pending={pending}
            onClick={() => start(async () => void (await archiveStrategy(strategy.id)))}
          >
            {t("archive")}
          </Button>
        </div>
      </div>
      {editing ? (
        <StrategyForm strategy={strategy} onDone={() => setEditing(false)} />
      ) : strategy.rules.length ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-text-soft">
          {strategy.rules.map((r) => (
            <li key={r.id}>{r.body}</li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function TagManager({ tags }: { tags: Tag[] }) {
  const t = useTranslations("journal");
  const [state, action, pending] = useActionState<JournalState, FormData>(createTag, null);
  const [removing, start] = useTransition();
  return (
    <div className="space-y-6">
      <form
        action={action}
        className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
        noValidate
      >
        <label className="block space-y-1.5 text-sm text-text-soft">
          <span>{t("strategiesPage.kind")}</span>
          <NativeSelect name="kind" defaultValue="setup">
            {(["setup", "mistake", "emotion"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="block space-y-1.5 text-sm text-text-soft">
          <span>{t("strategiesPage.tagName")}</span>
          <Input
            name="name"
            maxLength={40}
            required
            aria-invalid={(state?.status === "error" && state.code === "invalid") || undefined}
          />
        </label>
        <Button type="submit" pending={pending}>
          {t("strategiesPage.addTag")}
        </Button>
      </form>
      {state?.status === "error" ? (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${state.code}`)}
        </p>
      ) : null}
      {(["setup", "mistake", "emotion"] as const).map((kind) => (
        <div key={kind}>
          <h3 className="mb-2 text-sm font-medium text-text-soft">{t(`form.${kind}`)}</h3>
          <ul className="flex flex-wrap gap-2">
            {tags
              .filter((tag) => tag.kind === kind)
              .map((tag) => (
                <li
                  key={tag.id}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-hairline pl-3 text-sm"
                >
                  {tag.name}
                  {tag.own ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("strategiesPage.deleteTag", { name: tag.name })}
                      disabled={removing}
                      onClick={() => start(async () => void (await deleteTag(tag.id)))}
                      className="size-9"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  ) : (
                    <span className="pr-3 text-xs text-muted-foreground">
                      · {t("strategiesPage.preset")}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
