"use client";

import { FormField } from "@/components/FormField";

export function isCardPaymentMethod(method: string | null | undefined): boolean {
  const value = (method ?? "").trim().toLowerCase();
  return value === "card" || value === "credit card";
}

export interface SimulatedCardDetails {
  cardholderName: string;
  cardNumber: string;
  cardExp: string;
  cardCvv: string;
  billingZip: string;
}

interface SimulatedCardPaymentFieldsProps {
  idPrefix: string;
  values: SimulatedCardDetails;
  onChange: (next: SimulatedCardDetails) => void;
  disabled?: boolean;
}

export function SimulatedCardPaymentFields({
  idPrefix,
  values,
  onChange,
  disabled = false,
}: SimulatedCardPaymentFieldsProps) {
  function update<K extends keyof SimulatedCardDetails>(
    key: K,
    value: SimulatedCardDetails[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="rounded-box border border-base-300 bg-base-200/40 p-3 sm:col-span-2">
      <p className="mb-3 text-sm font-medium">Card details</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Cardholder name"
          htmlFor={`${idPrefix}-cardholder`}
          required
          className="sm:col-span-2"
        >
          <input
            id={`${idPrefix}-cardholder`}
            className="input input-bordered w-full"
            autoComplete="cc-name"
            placeholder="Name on card"
            value={values.cardholderName}
            disabled={disabled}
            required
            onChange={(event) => update("cardholderName", event.target.value)}
          />
        </FormField>
        <FormField
          label="Card number"
          htmlFor={`${idPrefix}-card-number`}
          required
          className="sm:col-span-2"
        >
          <input
            id={`${idPrefix}-card-number`}
            className="input input-bordered w-full"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="ACCT-000035"
            maxLength={19}
            value={values.cardNumber}
            disabled={disabled}
            required
            onChange={(event) => update("cardNumber", event.target.value)}
          />
        </FormField>
        <FormField
          label="Expiration (MM/YY)"
          htmlFor={`${idPrefix}-card-exp`}
          required
        >
          <input
            id={`${idPrefix}-card-exp`}
            className="input input-bordered w-full"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            maxLength={5}
            pattern="^(0[1-9]|1[0-2])\/\d{2}$"
            title="Use MM/YY format"
            value={values.cardExp}
            disabled={disabled}
            required
            onChange={(event) => update("cardExp", event.target.value)}
          />
        </FormField>
        <FormField label="CVV" htmlFor={`${idPrefix}-card-cvv`} required>
          <input
            id={`${idPrefix}-card-cvv`}
            className="input input-bordered w-full"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            maxLength={4}
            value={values.cardCvv}
            disabled={disabled}
            required
            onChange={(event) => update("cardCvv", event.target.value)}
          />
        </FormField>
        <FormField
          label="Billing ZIP"
          htmlFor={`${idPrefix}-card-zip`}
          required
          className="sm:col-span-2"
        >
          <input
            id={`${idPrefix}-card-zip`}
            className="input input-bordered w-full"
            autoComplete="postal-code"
            placeholder="43215"
            value={values.billingZip}
            disabled={disabled}
            required
            onChange={(event) => update("billingZip", event.target.value)}
          />
        </FormField>
      </div>
      <p className="mt-2 text-xs text-base-content/55">
        Simulated only — full card numbers are not stored. Only the last 4 digits
        are saved on the payment record.
      </p>
    </div>
  );
}

export const EMPTY_CARD_DETAILS: SimulatedCardDetails = {
  cardholderName: "",
  cardNumber: "",
  cardExp: "",
  cardCvv: "",
  billingZip: "",
};
