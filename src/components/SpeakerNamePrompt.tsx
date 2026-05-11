import { useState, useRef, useEffect } from "react";
import logoSrc from "../assets/logo-hl-noir.png";
import { verifyPin, type Speaker } from "../lib/api";

interface Props {
  onSubmit: (speaker: Speaker) => void;
}

export default function SpeakerNamePrompt({ onSubmit }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pinInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const speaker = await verifyPin(pin);
      onSubmit(speaker);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid PIN");
      setPin("");
      pinInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (value: string) => {
    setPin(value.replace(/\D/g, "").slice(0, 4));
    setError("");
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <img
            src={logoSrc}
            alt="Heritage Lab"
            className="h-14 mx-auto mb-6 object-contain"
          />
          <h1 className="text-3xl font-bold text-charcoal mb-2">
            Record Speech
          </h1>
          <p className="text-charcoal-light">
            Enter your 4-digit PIN to begin.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-cream-dark p-8"
        >
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-sage-light/40 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-forest-dark"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>

          <label
            htmlFor="pin"
            className="block text-sm font-medium text-charcoal mb-2"
          >
            Your PIN
          </label>
          <input
            ref={pinInputRef}
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => handlePinInput(e.target.value)}
            placeholder="••••"
            className="w-full px-4 py-3 rounded-xl border border-cream-dark bg-cream text-charcoal text-center text-2xl tracking-[0.5em] placeholder:text-charcoal-light/50 placeholder:tracking-[0.3em] placeholder:text-lg focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest transition-colors"
          />

          {error && (
            <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={pin.length !== 4 || loading}
            className="mt-4 w-full py-3 bg-forest-dark text-white rounded-xl font-medium hover:bg-charcoal transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying..." : "Unlock"}
          </button>
        </form>

        <p className="text-center text-charcoal-light/60 text-xs mt-6">
          Session: Time &bull; Place
        </p>
      </div>
    </div>
  );
}
