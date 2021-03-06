import { useCallback, useEffect, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

export const _config = {
    enqueue: (fn: () => void) => setTimeout(fn, 0),
    batch: unstable_batchedUpdates,
};

type Mapper<DATA, OP> = (state: DATA) => OP;
type Sub<DATA, OP> = { mapper: Mapper<DATA, OP>; update: () => void; last: OP };
type InternalDataStore<DATA> = {
    data: DATA;
    subs: Set<Sub<DATA, any>>;
};
export type UseSubType<DATA> = <OP>(mapper: Mapper<DATA, OP>, deps?: ReadonlyArray<unknown>) => OP;
export type StoreSetArg<DATA, K extends keyof DATA> =
    | Pick<DATA, K>
    | undefined
    | ((prev: DATA) => Pick<DATA, K> | undefined);
export type StoreSet<DATA> = <K extends keyof DATA>(update: StoreSetArg<DATA, K>) => void;
export type StoreRemoveListener = () => void;
export type StoreListen<DATA> = <OP>(
    mapper: Mapper<DATA, OP>,
    listener: (next: OP, prev: OP) => any
) => StoreRemoveListener;
export type StoreType<DATA> = { get: () => DATA; set: StoreSet<DATA>; listen: StoreListen<DATA> };
export type CreateStoreReturn<DATA> = [UseSubType<DATA>, StoreType<DATA>];

const _type = (a: any): string => Object.prototype.toString.call(a);
const _diffArr = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean =>
    a.length !== b.length || a.some((v, i) => b[i] !== v);
const _diff = (a: any, b: any): boolean => {
    if (a === b) return false;
    const aType = _type(a);
    if (aType !== _type(b)) return true;
    if (aType === '[object Array]') return _diffArr(a, b);
    if (aType === '[object Object]')
        return Object.keys(a)
            .concat(Object.keys(b))
            .some((i: string) => b[i] !== a[i]);
    return true;
};

const _dispatch = <DATA extends {}>(D: InternalDataStore<DATA>): void =>
    _config.batch(() => {
        D.subs.forEach((sub) => {
            const next = sub.mapper(D.data);
            if (_diff(next, sub.last)) {
                sub.last = next;
                sub.update();
            }
        });
    });

const _update = <DATA extends {}, K extends keyof DATA>(D: InternalDataStore<DATA>, next: Pick<DATA, K>): void => {
    const result = { ...D.data };
    Object.keys(next).forEach((key) => {
        result[key as keyof typeof next] = next[key as keyof typeof next];
    });
    D.data = result;
};

const _center = <DATA extends {}>(D: InternalDataStore<DATA>): StoreType<DATA> => ({
    get: () => D.data,
    set: <K extends keyof DATA>(update: StoreSetArg<DATA, K>) => {
        const next: Pick<DATA, K> | undefined = typeof update === 'function' ? update(D.data) : update;
        if (next) {
            _update(D, next);
            _config.enqueue(() => _dispatch(D));
        }
    },
    listen: <OP extends any>(mapper: Mapper<DATA, OP>, listener: (next: OP, prev: OP) => any): StoreRemoveListener => {
        const sub = { mapper, last: mapper(D.data) } as Sub<DATA, OP>;
        let thisLast = sub.last;
        sub.update = () => {
            // we have to enqueue the calling of the listener because otherwise expensive listeners could slow down
            // the notification of all other listeners
            _config.enqueue(() => {
                listener(sub.last, thisLast);
                thisLast = sub.last;
            });
        };
        D.subs.add(sub);
        return () => {
            D.subs.delete(sub);
        };
    },
});

const _emptyDeps = [] as ReadonlyArray<undefined>;
// helper hook to enforce controlled re-rendering of the component
const _toggle = (b: boolean) => !b;
const useUpdate = () => {
    const setBool = useState(true)[1];
    return useCallback(() => setBool(_toggle), []);
};

export const createStore = <DATA extends {}>(data: DATA): CreateStoreReturn<DATA> => {
    const D: InternalDataStore<DATA> = {
        data,
        subs: new Set<Sub<DATA, any>>(),
    };
    const Store = _center(D);
    const useSub = <OP extends any>(mapper: Mapper<DATA, OP>, deps: ReadonlyArray<unknown> = _emptyDeps): OP => {
        const lastDeps = useRef(deps);
        const update = useUpdate();
        const sub = useRef<Sub<DATA, OP>>({ mapper, update, last: mapper(D.data) });

        if (_diffArr(lastDeps.current, deps)) {
            sub.current.mapper = mapper;
            sub.current.last = mapper(D.data);
        }
        lastDeps.current = deps;

        useEffect(() => {
            D.subs.add(sub.current);
            return () => {
                D.subs.delete(sub.current);
            };
        }, []);

        return sub.current.last;
    };

    return [useSub, Store];
};
