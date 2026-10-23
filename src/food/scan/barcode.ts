/**
 * Shop barcodes (GS1: EAN-13, EAN-8, UPC-A, UPC-E) as the products dataset stores them.
 *
 * The dataset keeps Open Food Facts codes: EAN-13 and EAN-8 as printed, UPC-A as thirteen digits
 * with a leading zero, short codes padded with zeros to thirteen. A camera or a hand gives the code
 * as printed, so one scan is tried in all the shapes the same product can have.
 */

/** Only digits: a typed code may come with spaces or dashes („590 1234 567 890”). */
export function digitsOf(input: string): string {
  return input.replace(/\D/g, '');
}

/** The GS1 check digit for the digits before it: weights 3 and 1 from the right. */
export function checkDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** A complete GS1 code (8, 12, 13 or 14 digits) whose last digit checks out. */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  return checkDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/** A code a shelf product can carry: a valid GS1 code, or a UPC-E (its check digit is the long form's). */
export function isShopCode(code: string): boolean {
  return isValidGtin(code) || expandUpcE(code) !== null;
}

/**
 * UPC-E (8 digits, number system 0 or 1) written out as the UPC-A it shortens; `null` for anything
 * else, or when the check digit does not match - then it was an EAN-8.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [n, d1, d2, d3, d4, d5, d6, check] = code;
  const last = Number(d6);
  const body =
    last <= 2
      ? `${n}${d1}${d2}${d6}0000${d3}${d4}${d5}`
      : last === 3
        ? `${n}${d1}${d2}${d3}00000${d4}${d5}`
        : last === 4
          ? `${n}${d1}${d2}${d3}${d4}00000${d5}`
          : `${n}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return checkDigit(body) === Number(check) ? body + check : null;
}

/** The shapes one scanned or typed code can have in the dataset, the code as given first. */
export function codeVariants(raw: string): string[] {
  const code = digitsOf(raw);
  if (!code) return [];
  const variants = [code];
  if (code.length === 12) variants.push(`0${code}`);
  if (code.length === 14 && code.startsWith('0')) variants.push(code.slice(1));
  if (code.length === 13 && code.startsWith('0')) variants.push(code.slice(1));
  if (code.length === 8) {
    const upcA = expandUpcE(code);
    if (upcA) variants.push(`0${upcA}`);
  }
  if (code.length < 13) variants.push(code.padStart(13, '0'));
  return [...new Set(variants)];
}

/** The product for a code, in whichever shape the dataset has it. */
export function findByCode<T>(byCode: ReadonlyMap<string, T>, raw: string): T | null {
  for (const variant of codeVariants(raw)) {
    const found = byCode.get(variant);
    if (found) return found;
  }
  return null;
}

/**
 * A shop's own code (EAN-13 from 20 to 29): goods weighed or packed in the shop, with the weight or
 * the price inside the code. No product database knows them - nothing to look up.
 */
export function isInStoreCode(code: string): boolean {
  return /^2\d{12}$/.test(code);
}
