// Every template of the course, by unit (Swift: MathMiddleCatalog).
import type { Template } from './core';
import { templates as u01 } from './unit01';
import { templates as u02 } from './unit02';
import { templates as u03 } from './unit03';
import { templates as u04 } from './unit04';
import { templates as u05 } from './unit05';
import { templates as u06 } from './unit06';
import { templates as u07 } from './unit07';
import { templates as u08 } from './unit08';
import { templates as u09 } from './unit09';
import { templates as u10 } from './unit10';

let cached: Template[][] | null = null;

export function catalogUnits(): Template[][] {
  if (!cached) cached = [u01, u02, u03, u04, u05, u06, u07, u08, u09, u10];
  return cached;
}
