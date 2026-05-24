import React from 'react';
import { TextField } from '@mui/material';

export interface NumericInputCellProps {
  value: number;
  onCommit: (next: number) => void;
  step?: number;
  min?: number;
  error?: boolean;
  helperText?: React.ReactNode;
}

// Holds an editable string buffer separate from the numeric value so clearing
// the field to retype doesn't snap the value to $0 — and so submitting always
// reflects what the user sees. The buffer is committed on every parseable
// change; partial states like "" or "-" keep the previous numeric value until
// the user either types something parseable or blurs (which restores the
// buffer to the committed value).
export const NumericInputCell: React.FC<NumericInputCellProps> = ({
  value,
  onCommit,
  step,
  min,
  error,
  helperText
}) => {
  const [buffer, setBuffer] = React.useState<string>(String(value));

  // Sync the buffer when the parent-supplied value changes for reasons other
  // than the user typing (e.g. picking a QBO item that pre-fills a rate).
  React.useEffect(() => {
    setBuffer(prev => (parseFloat(prev) === value ? prev : String(value)));
  }, [value]);

  const handleBlur = () => {
    if (buffer.trim() === '' || !Number.isFinite(parseFloat(buffer))) {
      setBuffer(String(value));
    }
  };

  return (
    <TextField
      value={buffer}
      onChange={e => {
        const next = e.target.value;
        setBuffer(next);
        const parsed = parseFloat(next);
        if (Number.isFinite(parsed) && (min === undefined || parsed >= min)) {
          onCommit(parsed);
        }
      }}
      onBlur={handleBlur}
      type="number"
      size="small"
      error={error}
      helperText={helperText}
      inputProps={{ step, min, style: { textAlign: 'right' } }}
    />
  );
};

export default NumericInputCell;
