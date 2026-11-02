// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { freshState } from '../engine/plan';
import { setMeasures } from '../engine/measures';
import { addDays, dayKey } from '../engine/schedule';
import { addPhoto, forgetPhotos } from '../silhouette';
import { SilhouetteCard } from './Silhouette';

const POLISH = /[ąćęłńóśźż]/i;
const today = dayKey(Date.now());

beforeEach(async () => {
  await forgetPhotos();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

describe('Body shape card in English', () => {
  it('measurements, hint, form, photos and comparison without Polish', async () => {
    const s = freshState();
    setMeasures(s, addDays(today, -30), { waist: 92, thigh: 60 });
    setMeasures(s, addDays(today, -2), { waist: 90.5 });
    await addPhoto({ day: addDays(today, -30), full: new Blob([new Uint8Array(4)]), thumb: new Blob([new Uint8Array(2)]), w: 3, h: 4, at: 1 });
    await addPhoto({ day: addDays(today, -2), full: new Blob([new Uint8Array(4)]), thumb: new Blob([new Uint8Array(2)]), w: 3, h: 4, at: 2 });
    const { container } = render(<SilhouetteCard state={s} onMeasures={vi.fn()} onDeleteMeasures={vi.fn()} onToast={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Body shape' })).toBeInTheDocument();
    const waist = screen.getByText('Waist', { selector: '.sil-m-head span' }).closest('.sil-m')!;
    expect(waist).toHaveTextContent(/90\.5 cm/);
    expect(waist).toHaveTextContent(/−1\.5 cm since .+ · 2 measurements/);
    expect(screen.getByText(/first measured/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('How to measure'));
    expect(screen.getByText(/the WHO site/)).toBeVisible();
    expect(screen.getByLabelText('Waist, cm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save measurement' })).toBeInTheDocument();
    expect(screen.getByText(/aren’t in the backup file/)).toBeInTheDocument();

    await within(await screen.findByRole('list', { name: 'Photos by date' })).findAllByRole('button');
    await userEvent.click(screen.getByRole('button', { name: 'Compare two photos' }));
    expect(screen.getByLabelText('Before')).toBeInTheDocument();
    expect(screen.getByLabelText('After')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('list', { name: 'Photos by date' })).getAllByRole('button')[0]!);
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();

    expect(container.textContent).not.toMatch(POLISH);
  });
});
