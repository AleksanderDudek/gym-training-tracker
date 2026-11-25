import { describe, expect, it } from 'vitest';
import { formatPseudonym, parsePseudonym } from '@gymtracker/link';
import {
  addGroup,
  cleanGroupName,
  crmCsv,
  groupNames,
  importCsv,
  loadAliases,
  loadGroups,
  loadSeen,
  markSeen,
  parseCrmCsv,
  parseCsv,
  removeGroup,
  saveAlias,
  setGroups,
} from '../src/lib/aliases';

const A = parsePseudonym('GT-7K4Q-9XM2-HT3P-ZR8W-E5NA')!;
const B = parsePseudonym('GT-1B2C-3D4E-5F6G-7H8J-9K0M')!;
const user = () => crypto.randomUUID();

describe('Grupy podopiecznych', () => {
  it('dopisanie, usunięcie, jedna pisownia grupy, bez powtórek i pustych', () => {
    const u = user();
    addGroup(u, A, '  Kolano ');
    addGroup(u, A, 'redukcja; wiosna');
    addGroup(u, A, 'kolano');
    expect(loadGroups(u)).toEqual({ [A]: ['Kolano', 'redukcja wiosna'] });
    // U drugiego podopiecznego „KOLANO” trafia do istniejącej grupy „Kolano”.
    addGroup(u, B, 'KOLANO');
    expect(loadGroups(u)[B]).toEqual(['Kolano']);
    expect(groupNames(loadGroups(u))).toEqual(['Kolano', 'redukcja wiosna']);
    removeGroup(u, A, 'KOLANO');
    expect(loadGroups(u)[A]).toEqual(['redukcja wiosna']);
    setGroups(u, A, ['', '   ']);
    expect(loadGroups(u)[A]).toBeUndefined();
    expect(cleanGroupName('a'.repeat(50))).toHaveLength(32);
  });

  it('każdy prowadzący ma swoje grupy, a zepsuty zapis nie psuje strony', () => {
    const u = user();
    addGroup(u, A, 'Bieg');
    expect(loadGroups(user())).toEqual({});
    localStorage.setItem(`sztab-groups:${u}`, '{nie json');
    expect(loadGroups(u)).toEqual({});
    localStorage.setItem(`sztab-groups:${u}`, JSON.stringify({ [A]: ['ok', 7, ''], zly: ['x'] }));
    expect(loadGroups(u)).toEqual({ [A]: ['ok'] });
  });
});

describe('Arkusz CSV: skróty i grupy', () => {
  it('eksport z grupami i wczytanie z powrotem w innej przeglądarce', () => {
    const u = user();
    saveAlias(u, A, 'Jan, wtorki 18:00');
    addGroup(u, A, 'Kolano');
    addGroup(u, A, 'Poranne');
    saveAlias(u, B, '=HYPERLINK("x")');
    const csv = crmCsv([
      { pseudonym: formatPseudonym(A), alias: loadAliases(u)[A]!, areas: 'Trening, Żywienie', since: '1.11.2026', status: 'trwa', groups: loadGroups(u)[A]!.join(', ') },
      { pseudonym: formatPseudonym(B), alias: loadAliases(u)[B]!, areas: 'Trening', since: '2.11.2026', status: 'zakończona', groups: '' },
    ]);
    expect(csv.split('\r\n')[0]).toBe('﻿ID;Skrót;Obszary;Od;Stan;Grupy');

    const other = user();
    expect(importCsv(other, csv)).toEqual({ aliases: 2, groups: 1 });
    expect(loadAliases(other)).toEqual({ [A]: 'Jan, wtorki 18:00', [B]: '=HYPERLINK("x")' });
    expect(loadGroups(other)).toEqual({ [A]: ['Kolano', 'Poranne'] });
  });

  it('stary arkusz bez kolumny „Grupy” wczytuje skróty i nie rusza grup', () => {
    const u = user();
    addGroup(u, A, 'Kolano');
    // Taki, jaki wychodzi z Ustawień: bez grup.
    const old = crmCsv([{ pseudonym: formatPseudonym(A), alias: 'Ola', areas: 'Trening', since: '1.11', status: 'trwa' }]);
    expect(old.split('\r\n')[0]).toBe('﻿ID;Skrót;Obszary;Od;Stan');
    expect(parseCrmCsv(old).hasGroups).toBe(false);
    expect(importCsv(u, old)).toEqual({ aliases: 1, groups: 0 });
    expect(loadAliases(u)[A]).toBe('Ola');
    expect(loadGroups(u)).toEqual({ [A]: ['Kolano'] });
  });

  it('arkusz po CRM: przecinki, cudzysłowy, wiersze bez numeru i puste komórki', () => {
    const u = user();
    saveAlias(u, B, 'Zostaje');
    addGroup(u, B, 'Zostaje');
    const csv = [
      'Stan,ID,Alias,Groups',
      `trwa,${formatPseudonym(A).toLowerCase()},"Jan ""Kowal"", wt","Bieg, Siła"`,
      `trwa,${formatPseudonym(B)},,`,
      'trwa,GT-NIE-MA,Ktoś,X',
      '',
    ].join('\n');
    expect(parseCsv(csv)[1]).toEqual(['trwa', formatPseudonym(A).toLowerCase(), 'Jan "Kowal", wt', 'Bieg, Siła']);
    importCsv(u, csv);
    expect(loadAliases(u)).toEqual({ [A]: 'Jan "Kowal", wt', [B]: 'Zostaje' });
    expect(loadGroups(u)[B]).toEqual(['Zostaje']);
    expect(loadGroups(u)[A]).toEqual(['Bieg', 'Siła']);
  });

  it('plik bez kolumny ID nic nie wczytuje', () => {
    expect(importCsv(user(), 'Skrót;Grupy\r\nJan;Kolano\r\n')).toEqual({ aliases: 0, groups: 0 });
  });
});

describe('Ostatnie otwarcie podopiecznego', () => {
  it('per prowadzący, tylko liczby, najnowsze zostają', () => {
    const u = user();
    markSeen(u, 'c1', 1000);
    markSeen(u, 'c2', 2000);
    markSeen(u, 'c1', 3000);
    expect(loadSeen(u)).toEqual({ c1: 3000, c2: 2000 });
    expect(loadSeen(user())).toEqual({});
    localStorage.setItem(`sztab-seen:${u}`, JSON.stringify({ c1: 'x', c2: 5 }));
    expect(loadSeen(u)).toEqual({ c2: 5 });
  });
});
