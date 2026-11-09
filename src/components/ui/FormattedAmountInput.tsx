import React, { useEffect, useRef, useState } from 'react';
import { formatMoneyInput, normalizeMoneyInput } from '../../domain/moneyInput';

interface FormattedAmountInputProps {
  id?: string;
  value: string | number;
  onValueChange: (value: string) => void;
  required?: boolean;
  min?: string | number;
  max?: number;
  step?: string | number;
  autoFocus?: boolean;
  className?: string;
  placeholder?: string;
}

export function getUnformattedCaretPosition(display: string, selectionStart: number): number {
  const prefix = display.slice(0, Math.max(0, Math.min(selectionStart, display.length)));
  const digits = prefix.match(/\d/g)?.length || 0;
  const decimal = prefix.includes('.') ? 1 : 0;
  return Math.min(digits + decimal, normalizeMoneyInput(display).length);
}

export function FormattedAmountInput({ id, value, onValueChange, required = false, min, max, step, autoFocus, className = '', placeholder = '0.00' }: FormattedAmountInputProps) {
  const [editing, setEditing] = useState(false);
  const [display, setDisplay] = useState(() => formatMoneyInput(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDisplay(formatMoneyInput(value));
  }, [editing, value]);

  const validate = (input: HTMLInputElement, raw: string) => {
    const amount = Number(raw);
    const lower = min === undefined ? null : Number(min);
    if (raw && lower !== null && amount < lower) input.setCustomValidity(`El monto debe ser igual o mayor que ${lower}.`);
    else if (raw && max !== undefined && amount > max) input.setCustomValidity(`El monto no puede superar ${max}.`);
    else if (raw && step !== undefined && Number(step) > 0 && Math.abs((amount - (lower || 0)) / Number(step) - Math.round((amount - (lower || 0)) / Number(step))) > 1e-8) input.setCustomValidity(`Usa incrementos de ${step}.`);
    else input.setCustomValidity('');
  };

  return <input
    ref={inputRef}
    id={id}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    autoFocus={autoFocus}
    required={required}
    value={display}
    placeholder={placeholder}
    onFocus={(event) => {
      const input = event.currentTarget;
      const raw = normalizeMoneyInput(String(value));
      const caret = getUnformattedCaretPosition(input.value, input.selectionStart ?? input.value.length);
      setEditing(true);
      setDisplay(raw);
      requestAnimationFrame(() => input.setSelectionRange(Math.min(caret, raw.length), Math.min(caret, raw.length)));
    }}
    onChange={(event) => {
      const raw = normalizeMoneyInput(event.target.value);
      setDisplay(event.target.value);
      onValueChange(raw);
      validate(event.currentTarget, raw);
    }}
    onBlur={(event) => {
      const raw = normalizeMoneyInput(event.currentTarget.value);
      onValueChange(raw);
      setDisplay(formatMoneyInput(raw));
      validate(event.currentTarget, raw);
      setEditing(false);
    }}
    className={className}
  />;
}
