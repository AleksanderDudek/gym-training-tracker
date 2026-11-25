import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Teksty sprawdzamy po polsku niezależnie od języka środowiska testowego.
vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

const factors: { id: string; factor_type: string; status: string; friendly_name?: string; created_at: string }[] = [
  { id: 'old', factor_type: 'totp', status: 'unverified', friendly_name: 'Sztab', created_at: '2026-11-01T10:00:00Z' },
];

const mfa = {
  listFactors: vi.fn(async () => ({ data: { all: [...factors] }, error: null })),
  unenroll: vi.fn(async ({ factorId }: { factorId: string }) => {
    const i = factors.findIndex((f) => f.id === factorId);
    if (i >= 0) factors.splice(i, 1);
    return { data: { id: factorId }, error: null };
  }),
  enroll: vi.fn(async () => {
    factors.push({ id: 'new', factor_type: 'totp', status: 'unverified', friendly_name: 'Sztab', created_at: '2026-11-25T10:00:00Z' });
    return { data: { id: 'new', totp: { uri: 'otpauth://totp/Sztab:a@b.pl?secret=JBSWY3DPEHPK3PXP&issuer=Sztab', secret: 'JBSWY3DPEHPK3PXP' } }, error: null };
  }),
  challengeAndVerify: vi.fn(async ({ factorId, code }: { factorId: string; code: string }) => {
    if (code !== '123456') return { data: null, error: { code: 'mfa_verification_failed', status: 400 } };
    const f = factors.find((x) => x.id === factorId);
    if (f) f.status = 'verified';
    return { data: {}, error: null };
  }),
};

vi.mock('../src/lib/sb', () => ({ sb: { auth: { mfa } } }));

describe('Ustawienia → logowanie dwuetapowe', () => {
  it('włączenie: sprząta porzuconą próbę, pokazuje sekret, zły kod odrzuca, dobry włącza; wyłączenie żąda kodu', async () => {
    const { MfaSection } = await import('../src/pages/MfaSection');
    const user = userEvent.setup();
    render(<MfaSection />);

    await user.click(await screen.findByRole('button', { name: 'Włącz' }));
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'old' });
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Sztab' });
    expect(await screen.findByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /QR/ })).toBeInTheDocument();

    const input = screen.getByLabelText('Kod z aplikacji (6 cyfr)');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    await user.type(input, '000000');
    await user.click(screen.getByRole('button', { name: 'Potwierdź i włącz' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Zły albo wygasły kod');

    await user.clear(input);
    await user.type(input, '123 456');
    await user.click(screen.getByRole('button', { name: 'Potwierdź i włącz' }));
    expect(await screen.findByText('Włączone')).toBeInTheDocument();
    expect(mfa.challengeAndVerify).toHaveBeenLastCalledWith({ factorId: 'new', code: '123456' });

    // Wyłączenie: najpierw kod, dopiero potem unenroll.
    mfa.unenroll.mockClear();
    await user.click(screen.getByRole('button', { name: 'Wyłącz' }));
    await user.type(screen.getByLabelText('Kod z aplikacji (6 cyfr)'), '999999');
    await user.click(screen.getByRole('button', { name: 'Wyłącz logowanie dwuetapowe' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mfa.unenroll).not.toHaveBeenCalled();
    const again = screen.getByLabelText('Kod z aplikacji (6 cyfr)');
    await user.clear(again);
    await user.type(again, '123456');
    await user.click(screen.getByRole('button', { name: 'Wyłącz logowanie dwuetapowe' }));
    expect(await screen.findByText('Wyłączone')).toBeInTheDocument();
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'new' });
  });
});
