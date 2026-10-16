"use client";

import { useEffect, useRef, useState } from "react";
import type { ChallengeResult } from "@/core/challenge/quickChallenge";
import { shareSummary, shareText, type ShareText } from "@/core/challenge/share";
import { useI18n } from "../i18n";
import { renderShareCard } from "./shareCard";
import dialogStyles from "../WelcomeScreen.module.css";
import styles from "./QuickChallengeScreen.module.css";

/** A card made for one result, in one language: its image, ready to share, download or show. */
interface PreparedCard {
  text: ShareText;
  file: File;
  /** The image's object URL, for the preview and the download. */
  url: string;
  /** The data navigator.share takes for this card, or null where the browser can't share it as a file. */
  shareData: ShareData | null;
}

type Notice = { kind: "ok" | "info" | "error"; text: string };

/**
 * The Quick Challenge's "Share result": a dialog that prepares the result's card (shareCard.ts) and shows it, with
 * Share image (the system's share sheet, where the browser can share files), Download image and Copy link (the
 * public home page). The card is made from the result and language it opens with, and made again if either
 * changes while it is open; a card being made for an earlier result or language is dropped, never shown. The share
 * sheet is opened straight from the button's click, with the card already made, so the browser's user activation
 * holds. See docs/QUICK-CHALLENGE-SHARING.md.
 */
export function ShareResultDialog({ result, open, onClose }: { result: ChallengeResult; open: boolean; onClose: () => void }) {
  const { locale } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // To the title (its body is drawn by now): the actions wait for the card, and a screen reader starts there.
      dialog.querySelector<HTMLElement>("#challenge-share-title")?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${dialogStyles.dialog} ${styles.shareDialog}`}
      aria-labelledby="challenge-share-title"
      data-testid="challenge-share-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {/* Made afresh for each opening, language and retry: a new body starts with no card. */}
      {open && <ShareBody key={`${locale}:${attempt}`} result={result} onRetry={() => setAttempt((n) => n + 1)} onClose={() => ref.current?.close()} />}
    </dialog>
  );
}

function ShareBody({ result, onRetry, onClose }: { result: ChallengeResult; onRetry: () => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [card, setCard] = useState<PreparedCard | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Made for this result and language; a card finished after either changed, or after closing, is dropped.
  useEffect(() => {
    let current = true;
    let made: PreparedCard | null = null;
    const text = shareText(shareSummary(result), locale);
    renderShareCard(text).then(
      ({ blob }) => {
        if (!current) return;
        const file = new File([blob], text.fileName, { type: "image/png" });
        made = { text, file, url: URL.createObjectURL(blob), shareData: shareDataFor(file, text) };
        setCard(made);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
      if (made) URL.revokeObjectURL(made.url);
    };
  }, [result, locale]);

  // Directly in the click: no await before navigator.share, so the click's activation is still there.
  const shareImage = () => {
    if (!card?.shareData) return;
    setNotice(null);
    navigator.share(card.shareData).then(
      () => setNotice({ kind: "ok", text: t("challengeShare.shared") }),
      (error: unknown) => {
        // Closing the share sheet is not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice({ kind: "error", text: t("challengeShare.shareFailed") });
      },
    );
  };

  const download = () => {
    if (!card) return;
    const link = document.createElement("a");
    link.href = card.url;
    link.download = card.text.fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setNotice({ kind: "info", text: t("challengeShare.downloaded") });
  };

  const copyLink = async () => {
    if (!card) return;
    const url = card.text.url;
    const copied = await copyText(url);
    setNotice(copied ? { kind: "ok", text: t("challengeShare.copied") } : { kind: "error", text: t("challengeShare.copyFailed", { url }) });
  };

  const canShare = !!card?.shareData;
  return (
    <div className={dialogStyles.dialogBody}>
      <h2 id="challenge-share-title" className={dialogStyles.dialogTitle} tabIndex={-1}>
        {t("challengeShare.title")}
      </h2>
      <div className={styles.sharePreview} data-state={card ? "ready" : failed ? "failed" : "preparing"}>
        {card ? (
          // An object URL of the card just made: next/image has nothing to optimise here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.url} alt={card.text.alt} width={1080} height={1350} data-testid="challenge-share-image" data-locale={locale} />
        ) : (
          <p className={styles.text} role="status">
            {failed ? t("challengeShare.prepareFailed") : t("challengeShare.preparing")}
          </p>
        )}
      </div>
      {failed && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          {t("challengeShare.retry")}
        </button>
      )}
      {card && !canShare && <p className={styles.shareNote}>{t("challengeShare.noFileShare")}</p>}
      <p className={styles.shareNotice} data-kind={notice?.kind} aria-live="polite" data-testid="challenge-share-notice">
        {notice?.text}
      </p>
      <div className={dialogStyles.dialogActions}>
        {canShare && (
          <button type="button" className="btn btn-primary btn-block" onClick={shareImage} data-testid="challenge-share-native">
            {t("challengeShare.shareImage")}
          </button>
        )}
        <button type="button" className={`btn ${canShare ? "btn-secondary" : "btn-primary"} btn-block`} onClick={download} disabled={!card} data-testid="challenge-share-download">
          {t("challengeShare.download")}
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={copyLink} disabled={!card} data-testid="challenge-share-copy">
          {t("challengeShare.copyLink")}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose} data-testid="challenge-share-close">
          {t("challengeShare.close")}
        </button>
      </div>
    </div>
  );
}

/** What navigator.share takes for the card (with its words where the browser takes both), or null if it can't share files. */
function shareDataFor(file: File, text: ShareText): ShareData | null {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return null;
  const withText: ShareData = { files: [file], title: text.label, text: text.message };
  if (navigator.canShare(withText)) return withText;
  const filesOnly: ShareData = { files: [file] };
  return navigator.canShare(filesOnly) ? filesOnly : null;
}

/** Copies `value`: the Clipboard API, or where it is missing or refused (an http:// address), a hidden text field's copy. */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Refused: try the older way below.
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  // Inside the open dialog: the page behind a modal dialog is inert, and a field there can't be selected.
  (document.querySelector("dialog[open]") ?? document.body).append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}
