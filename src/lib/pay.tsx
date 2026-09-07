import React from "react";
import { formatPrice } from "./client";

export function PayConfirm({
  open,
  amountPaise,
  paying,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  amountPaise: number;
  paying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="wx-modal-backdrop" onClick={onCancel}>
      <div
        className="wx-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm payment"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="wx-modal-title">Pay to send</h2>
        <p className="wx-modal-sub">
          Each question in the chat is a single paid message. Confirm the payment of{" "}
          <strong>{formatPrice(amountPaise)}</strong> to send this message.
        </p>
        <form
          className="wx-auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
          }}
        >
          <button type="submit" className="wx-btn wx-btn-primary wx-auth-submit" disabled={paying}>
            {paying ? "Processing…" : `Pay ${formatPrice(amountPaise)}`}
          </button>
          <button type="button" className="wx-linkbtn" onClick={onCancel}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}