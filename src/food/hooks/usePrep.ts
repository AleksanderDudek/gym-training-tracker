import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../diet/db';
import type { PrepPlan } from '../prep/types';

/** Every meal-prep plan on the device (`undefined` while IndexedDB answers). */
export function usePrepPlans(): PrepPlan[] | undefined {
  return useLiveQuery(() => db.prep.toArray(), []);
}
