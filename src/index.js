// @flow

import { useEffect, useRef, useState } from 'react';
import { unstable_batchedUpdates as batch } from 'react-dom';

type Mapper<DATA, OP> = (state: DATA) => OP;
type Updater<OP> = (OP | (OP => OP)) => void;
type Sub<DATA, OP> = { mapper: Mapper<DATA, OP>, update: Updater<OP>, last: OP };
type InternalDataStore<DATA> = {
    data: DATA,
    subs: Set<Sub<DATA, any>>,
    keys: Array<$Keys<DATA>>,
};
type UseSubType<DATA> = <OP>(mapper: Mapper<DATA, OP>) => OP;
type StoreSetArg<DATA> = $Shape<DATA> | ((prev: DATA) => $Shape<DATA>);
type StoreSet<DATA> = (update: StoreSetArg<DATA>) => void;
type StoreType<DATA> = { get: () => DATA, set: StoreSet<DATA> };
type CreateStoreReturn<DATA> = [UseSubType<DATA>, StoreType<DATA>];

const _enqueue = (fn: () => void) => window.setTimeout(fn, 0);
const _type = (a: any): string => Object.prototype.toString.call(a);
const _diff = (a: any, b: any): boolean => {
    if (a === b) return false;
    const aType = _type(a);
    if (aType !== _type(b)) return true;
    if (aType === '[object Array]') return a.length !== b.length || Object.keys(a).some((i: string) => b[i] !== a[i]);
    if (aType === '[object Object]')
        return Object.keys(a)
            .concat(Object.keys(b))
            .some((i: string) => b[i] !== a[i]);
    return true;
};

const _dispatch = <DATA: {}>(D: InternalDataStore<DATA>): void =>
    batch(() => {
        D.subs.forEach(({ mapper, update, last }) => {
            const nowMapped = mapper(D.data);
            if (_diff(nowMapped, last)) {
                update(nowMapped);
            }
        });
    });

const _update = <DATA: {}>(D: InternalDataStore<DATA>, next: $Shape<DATA>): void => {
    const result = ({}: any);
    D.keys.forEach(key => {
        const p = D.data[key];
        const n = next[key];
        result[key] = n !== undefined ? n : p;
    });
    D.data = result;
};

const _center = <DATA: {}>(D: InternalDataStore<DATA>): StoreType<DATA> => ({
    get: () => D.data,
    set: (update: StoreSetArg<DATA>) => {
        const next: $Shape<DATA> = typeof update === 'function' ? update(D.data) : update;
        _update(D, next);
        _enqueue(() => _dispatch(D));
    },
});

export const createStore = <DATA: {}>(data: DATA): CreateStoreReturn<DATA> => {
    const keys: any[] = Object.keys(data);
    const D: InternalDataStore<DATA> = {
        data,
        subs: new Set<Sub<DATA, any>>(),
        keys,
    };
    const Store = _center(D);
    const useSub = <OP>(mapper: Mapper<DATA, OP>): OP => {
        const [mapped, update] = useState<OP>(() => mapper(D.data));
        const sub = useRef<Sub<DATA, OP>>({ mapper, update, last: mapped });
        sub.current.last = mapped;

        useEffect(() => {
            D.subs.add(sub.current);
            return () => {
                D.subs.delete(sub.current); // eslint-disable-line
            };
        }, []); // eslint-disable-line

        return mapped;
    };

    return [useSub, Store];
};
