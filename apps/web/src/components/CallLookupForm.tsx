import { useState } from 'react';
import type { FormEvent } from 'react';

interface CallLookupFormProps {
  defaultValue?: string;
  loading?: boolean;
  onSubmit: (callId: string) => Promise<void> | void;
  allowMockSample?: boolean;
  onLoadSample?: () => void;
}

export const CallLookupForm = ({
  defaultValue = '',
  loading = false,
  onSubmit,
  allowMockSample = false,
  onLoadSample,
}: CallLookupFormProps) => {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      setError('Enter a Teams call ID.');
      return;
    }

    setError(null);
    await onSubmit(trimmed);
  };

  return (
    <form className="lookup-form" onSubmit={handleSubmit}>
      <label className="lookup-form__label" htmlFor="call-id">
        Microsoft Teams Call ID
      </label>
      <div className="lookup-form__input-row">
        <input
          id="call-id"
          className="lookup-form__input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. 8f03f4f0-..."
          disabled={loading}
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Fetching…' : 'Load SIP Ladder'}
        </button>
      </div>
      {allowMockSample && onLoadSample ? (
        <button
          className="link-button"
          type="button"
          onClick={onLoadSample}
          disabled={loading}
        >
          Load sample call from mock data
        </button>
      ) : null}
      {error ? <p className="lookup-form__error">{error}</p> : null}
    </form>
  );
};
