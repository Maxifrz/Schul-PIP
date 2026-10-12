// The templates of each unit and which of them each lesson teaches. A port of MathUpperCatalog
// (MathUpperCourse.swift).

import type { UTemplate } from './core';
import { MathUpperUnit01 } from './unit01';
import { MathUpperUnit02 } from './unit02';
import { MathUpperUnit03 } from './unit03';
import { MathUpperUnit04 } from './unit04';
import { MathUpperUnit05 } from './unit05';
import { MathUpperUnit06 } from './unit06';
import { MathUpperUnit07 } from './unit07';

export const MathUpperCatalog = {
  /** The templates of each unit, in unit order. */
  units: [
    MathUpperUnit01.templates,
    MathUpperUnit02.templates,
    MathUpperUnit03.templates,
    MathUpperUnit04.templates,
    MathUpperUnit05.templates,
    MathUpperUnit06.templates,
    MathUpperUnit07.templates,
  ] as readonly (readonly UTemplate[])[],

  /** Which templates are new in lesson 1, 2 and 3 of each unit (by template id). */
  lessonGroups: [
    [['d1.power', 'd1.value', 'd1.linear'], ['d1.slope', 'd1.where', 'd1.negexp'], ['d1.tangentT', 'd1.tangentY', 'd1.flat']],
    [['k.yaxis', 'k.root', 'k.rootTest', 'k.sym'], ['k.extX', 'k.extY', 'k.kind'], ['k.inflect', 'k.mono', 'k.slope']],
    [['i.anti', 'i.noC', 'i.definite'], ['i.signed', 'i.area', 'i.rules'], ['i.mean', 'i.upper', 'i.area']],
    [['e.deriv', 'e.anti', 'e.zero'], ['e.inverse', 'e.lnDeriv', 'e.log'], ['e.lawChoice', 'e.laws', 'e.solve', 'e.lnSolve']],
    [['t.rad', 't.deg', 't.exact', 't.sign'], ['t.pyth', 't.deriv', 't.derivAt', 't.solve'], ['t.period', 't.amp', 't.zeros', 't.int']],
    [['v.norm', 'v.vecAB', 'v.dist', 'v.mid'], ['v.dot', 'v.orthoChoice', 'v.orthoT', 'v.angle'], ['v.linePoint', 'v.lineT', 'v.onLine', 'v.dir']],
    [['s.dice', 's.urn', 's.choose'], ['s.pmf', 's.cum', 's.expect'], ['s.table', 's.cond', 's.indep', 's.bayes']],
  ] as readonly (readonly (readonly string[])[])[],

  template(id: string): UTemplate | undefined {
    for (const unit of MathUpperCatalog.units) {
      const found = unit.find((t) => t.id === id);
      if (found) return found;
    }
    return undefined;
  },
};
