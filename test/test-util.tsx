import React from 'react';
import { render } from '@testing-library/react';
import { createStore, _config } from '../src';
import { act } from 'react-dom/test-utils';

_config.batch = act as any;
_config.dispatch = (fn): any => fn();

describe('test-util', () => {
    it('allows to update the react state without the need of jest.runAllTimers', () => {
        const [useSub, Store] = createStore({ foo: true });
        let currentReceived: any = null;
        let renderCount = 0;
        const Dummy = ({ bool }: { bool: boolean }) => {
            ++renderCount;
            currentReceived = useSub(({ foo }) => foo === bool);
            return null;
        };
        const { rerender } = render(<Dummy bool={true} />);

        // initial render
        expect(renderCount).toBe(1);
        expect(currentReceived).toBe(true);

        // rerender the component with different bool
        rerender(<Dummy bool={false} />);

        // the dep array changed and the value needs to be recomputed
        expect(renderCount).toBe(2);
        expect(currentReceived).toBe(false);

        // update the store value so that we receive the original value which was also computed last time
        // but only by dependency change
        Store.set({ foo: false });

        expect(renderCount).toBe(3);
        expect(currentReceived).toBe(true);

        // does re-render twice instead of not-updating when test-util is activated
        Store.set({ foo: true });
        Store.set({ foo: false });

        expect(renderCount).toBe(5);
        expect(currentReceived).toBe(true);
    });

    it('allows to trigger listeners without the need of jest.runAllTimers', () => {
        const spy = jest.fn();
        const [, Store] = createStore({ foo: 'bar', num: 42 });

        // when
        const removeListener = Store.listen(
            ({ foo, num }) => ({ odd: num % 2 === 1, fooLength: foo.length }),
            (next, prev) => {
                // don't make it shorter by putting the spy as listener, because we are also testing the TS integration
                spy({
                    odd: next.odd as boolean,
                    fooLength: next.fooLength as number,
                    prevOdd: prev.odd as boolean,
                    prevFooLength: prev.fooLength as number,
                });

                // return value will be ignored and can be of any type
                return 'foo';
            }
        );

        // initially
        expect(spy).not.toHaveBeenCalled();

        // when - updating without changing the length of "foo"
        Store.set({ foo: 'wha' });

        // then
        expect(spy).not.toHaveBeenCalled();

        // when - updating length of "foo"
        Store.set({ foo: 'what' });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith({ odd: false, fooLength: 4, prevOdd: false, prevFooLength: 3 });

        spy.mockReset();
        Store.set({ foo: 'yo' });
        Store.set({ num: 13 });

        // be aware the test utils don't process all requests batched but sequential, hence all updates are received
        // individually for every call of "Store.set"
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenCalledWith({ odd: false, fooLength: 2, prevOdd: false, prevFooLength: 4 });
        expect(spy).toHaveBeenCalledWith({ odd: true, fooLength: 2, prevOdd: false, prevFooLength: 2 });

        spy.mockReset();
        removeListener();

        Store.set({ foo: 'update' });
        expect(spy).not.toHaveBeenCalled();
    });
});
