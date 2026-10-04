import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { PrescriberMessage, Prescription, PrescriptionItem, ProductRef } from "@/shared/api/pharmacy";
import { Card } from "@/shared/components/Card";
import { formatDateTime } from "../lib/format";
import { CardActions } from "./CardActions";
import { CollectionDrawer } from "./CollectionDrawer";
import { CollectionSummaryLine } from "./CollectionSummaryLine";
import { useRequestSubstitution } from "./hooks/useItemMutations";
import { useSendPrescriberMessage } from "./hooks/usePrescriberMessage";
import { ItemRow } from "./ItemRow";
import { MessagePrescriberForm } from "./MessagePrescriberForm";
import { PrescriptionHeader } from "./PrescriptionHeader";

// The server rejects a substitution note longer than this.
const SUBSTITUTION_NOTE_MAX = 500;

// What the prescriber-message box is for right now: a free question, or a
// substitute request whose text is prefilled and whose send also records it.
interface Composer {
  initialText: string;
  substitution: { itemId: string; productId: string } | null;
}

function substituteRequestText(p: Prescription, item: PrescriptionItem, substitute: ProductRef): string {
  return (
    `${item.drugName} (${item.dosage} × ${item.quantity}) for ${p.patientName}, ${p.serialNumber}, has no usable stock. ` +
    `May I substitute ${substitute.name}? I won't dispense it unless you approve.`
  );
}

export function PrescriptionCard({ prescription: p }: { prescription: Prescription }) {
  const [collectionMode, setCollectionMode] = useState<"patient" | "thirdParty" | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [sentMessages, setSentMessages] = useState<PrescriberMessage[]>([]);

  const sendMessage = useSendPrescriberMessage(p.id);
  const requestSubstitution = useRequestSubstitution(p.id);

  function openSubstituteRequest(item: PrescriptionItem, substitute: ProductRef) {
    setComposer({
      initialText: substituteRequestText(p, item, substitute),
      substitution: { itemId: item.id, productId: substitute.id },
    });
  }

  function send(text: string) {
    if (composer?.substitution) {
      const { itemId, productId } = composer.substitution;
      requestSubstitution.mutate(
        { itemId, substituteProductId: productId, note: text },
        { onSuccess: () => setComposer(null) },
      );
      return;
    }
    sendMessage.mutate(text, {
      onSuccess: (saved) => {
        setSentMessages((all) => [...all, saved]);
        setComposer(null);
      },
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <PrescriptionHeader prescription={p} />
      {p.items.some((item) => item.dispensedQuantity > 0) && <CollectionSummaryLine prescriptionId={p.id} />}

      <ul className="flex flex-col gap-2">
        {p.items.map((item) => (
          <ItemRow key={item.id} prescription={p} item={item} onAskSubstitute={openSubstituteRequest} />
        ))}
      </ul>

      <CardActions
        prescription={p}
        onConfirmCollection={() => setCollectionMode("patient")}
        onThirdParty={() => setCollectionMode("thirdParty")}
        onMessage={() => setComposer({ initialText: "", substitution: null })}
      />

      {composer && (
        <MessagePrescriberForm
          key={composer.substitution?.itemId ?? "free"}
          prescriberName={p.prescriberName}
          initialText={composer.initialText}
          maxLength={composer.substitution ? SUBSTITUTION_NOTE_MAX : undefined}
          loading={sendMessage.isPending || requestSubstitution.isPending}
          onSend={send}
          onCancel={() => setComposer(null)}
        />
      )}

      {sentMessages.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border-subtle pt-3">
          {sentMessages.map((m) => (
            <p key={m.id} className="text-[12.5px] text-text-secondary">
              <span className="font-semibold text-text-primary">{m.senderName ?? "You"}</span> to{" "}
              {p.prescriberName ?? "prescriber"} · {formatDateTime(m.sentAt)}: {m.message}
            </p>
          ))}
          {p.prescriberEmail && (
            <p className="flex items-center gap-1.5 text-[12px] text-success-600">
              <CheckCircle2 className="size-3" aria-hidden />
              Email sent to {p.prescriberEmail}
            </p>
          )}
        </div>
      )}

      <CollectionDrawer
        open={collectionMode !== null}
        prescription={p}
        startWithThirdParty={collectionMode === "thirdParty"}
        onClose={() => setCollectionMode(null)}
      />
    </Card>
  );
}
