/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  ConfigureOptions,
  getResultFromIdleTask,
  SetIdleTaskOptions,
  WaitForIdleTaskOptions,
} from './index';

describe('idle-task', () => {
  let idleTaskModule: typeof import('./index') | null = null;
  const requestIdleCallbackImpl =
    (didTimeout = false) =>
    (cb: IdleRequestCallback, _options?: IdleRequestOptions): number => {
      const start = Date.now();
      return window.setTimeout(function () {
        cb({
          didTimeout,
          timeRemaining: function () {
            return didTimeout ? 0 : Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1);
    };

  const mockRequestIdleCallback = jest
    .fn()
    .mockImplementation(requestIdleCallbackImpl());
  window.requestIdleCallback = mockRequestIdleCallback;
  const mockCancelIdleCallback = jest
    .fn()
    .mockImplementation(id => window.clearTimeout(id));
  window.cancelIdleCallback = mockCancelIdleCallback;

  const mockFirstTask = jest.fn().mockImplementation(() => 'mockFirstTask');
  const mockSecondTask = jest.fn().mockImplementation(() => 'mockSecondTask');
  const mockThirdTask = jest.fn().mockImplementation(() => 'mockThirdTask');

  const createTask =
    (mockFunction?: jest.Mock, time = 0) =>
    () => {
      if (mockFunction) {
        jest.advanceTimersByTime(time);
        return mockFunction();
      }
    };

  const runRequestIdleCallback = () => {
    jest.advanceTimersByTime(1);
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    import('./index').then(module => {
      idleTaskModule = module;
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.resetModules();
    idleTaskModule = null;
  });

  describe('configureIdleTask', () => {
    let mockConfigureIdleTask: jest.SpyInstance;

    beforeEach(() => {
      mockConfigureIdleTask = jest.spyOn(
        idleTaskModule as any,
        'configureIdleTask'
      );
    });

    afterEach(() => {
      mockConfigureIdleTask.mockReset();
    });

    describe('not called configure', () => {
      beforeEach(() => {
        idleTaskModule!.setIdleTask(createTask());
        runRequestIdleCallback();
      });

      it('requestIdleCallback called without option', () => {
        expect(mockRequestIdleCallback.mock.calls[0][1]).toStrictEqual({
          timeout: undefined,
        });
      });

      it('not called configureIdleTask', () => {
        expect(mockConfigureIdleTask).not.toHaveBeenCalled();
      });
    });

    describe('called configure', () => {
      const expected: ConfigureOptions = {
        interval: 1000,
        debug: false,
        timeout: 3000,
        cache: false,
      };

      beforeEach(() => {
        idleTaskModule!.configureIdleTask(expected);
        idleTaskModule!.setIdleTask(createTask());
        runRequestIdleCallback();
      });

      it('requestIdleCallback called with option', () => {
        expect(mockRequestIdleCallback.mock.calls[0][1]).toStrictEqual({
          timeout: expected.interval,
        });
      });

      it('called configureIdleTask with options', () => {
        expect(mockConfigureIdleTask).toHaveBeenCalledWith(expected);
      });
    });
  });

  describe('setIdleTask', () => {
    describe('not debug mode', () => {
      describe('executed once', () => {
        let taskId: number;

        beforeEach(() => {
          taskId = idleTaskModule!.setIdleTask(createTask());
        });

        it('task id is 1', () => {
          expect(taskId).toBe(1);
        });

        it('called requestIdleCallback', () => {
          expect(mockRequestIdleCallback.mock.calls.length).toBe(1);
        });
      });

      describe('executed twice', () => {
        let taskId: number;

        beforeEach(() => {
          idleTaskModule!.setIdleTask(createTask());
          taskId = idleTaskModule!.setIdleTask(createTask());
        });

        it('task id is 2', () => {
          expect(taskId).toBe(2);
        });

        it('called requestIdleCallback once', () => {
          expect(mockRequestIdleCallback.mock.calls.length).toBe(1);
        });
      });

      describe('priority is low', () => {
        beforeEach(() => {
          idleTaskModule!.setIdleTask(createTask(mockFirstTask, 100));
          idleTaskModule!.setIdleTask(createTask(mockSecondTask, 100));
          idleTaskModule!.setIdleTask(createTask(mockThirdTask, 100));
          runRequestIdleCallback();
        });

        it('first task is called', () => {
          expect(mockFirstTask.mock.calls.length).toBe(1);
        });

        it('second task is not called', () => {
          expect(mockSecondTask.mock.calls.length).toBe(0);
        });

        it('third task is not called', () => {
          expect(mockThirdTask.mock.calls.length).toBe(0);
        });

        it('called requestIdleCallback twice', () => {
          expect(mockRequestIdleCallback.mock.calls.length).toBe(2);
        });
      });

      describe('priority is high', () => {
        beforeEach(() => {
          idleTaskModule!.setIdleTask(createTask(mockFirstTask, 100));
          idleTaskModule!.setIdleTask(createTask(mockSecondTask, 100));
          idleTaskModule!.setIdleTask(createTask(mockThirdTask, 100), {
            priority: 'high',
          });
          runRequestIdleCallback();
        });

        it('first task is not called', () => {
          expect(mockFirstTask.mock.calls.length).toBe(0);
        });

        it('second task is not called', () => {
          expect(mockSecondTask.mock.calls.length).toBe(0);
        });

        it('third task is called', () => {
          expect(mockThirdTask.mock.calls.length).toBe(1);
        });

        it('called requestIdleCallback twice', () => {
          expect(mockRequestIdleCallback.mock.calls.length).toBe(2);
        });
      });

      describe('timeout', () => {
        const mockRequestIdleCallbackDidTimeout = jest
          .fn()
          .mockImplementation(requestIdleCallbackImpl(true));

        beforeEach(() => {
          window.requestIdleCallback = mockRequestIdleCallbackDidTimeout;
        });

        afterEach(() => {
          window.requestIdleCallback = mockRequestIdleCallback;
        });

        describe('executed time is less than 50ms', () => {
          beforeEach(() => {
            idleTaskModule!.setIdleTask(createTask(mockFirstTask, 25));
            idleTaskModule!.setIdleTask(createTask(mockSecondTask, 24));
            idleTaskModule!.setIdleTask(createTask(mockThirdTask, 1));
            runRequestIdleCallback();
          });

          it('first task is called', () => {
            expect(mockFirstTask.mock.calls.length).toBe(1);
          });

          it('second task is called', () => {
            expect(mockSecondTask.mock.calls.length).toBe(1);
          });

          it('third task is called', () => {
            expect(mockThirdTask.mock.calls.length).toBe(1);
          });

          it('called requestIdleCallback once', () => {
            expect(mockRequestIdleCallbackDidTimeout.mock.calls.length).toBe(1);
          });
        });

        describe('executed time is over 50ms', () => {
          beforeEach(() => {
            idleTaskModule!.setIdleTask(createTask(mockFirstTask, 25));
            idleTaskModule!.setIdleTask(createTask(mockSecondTask, 25));
            idleTaskModule!.setIdleTask(createTask(mockThirdTask, 1));
            runRequestIdleCallback();
          });

          it('first task is called', () => {
            expect(mockFirstTask.mock.calls.length).toBe(1);
          });

          it('second task is called', () => {
            expect(mockSecondTask.mock.calls.length).toBe(1);
          });

          it('third task is not called', () => {
            expect(mockThirdTask.mock.calls.length).toBe(0);
          });

          it('called requestIdleCallback twice', () => {
            expect(mockRequestIdleCallbackDidTimeout.mock.calls.length).toBe(2);
          });
        });
      });
    });

    describe('debug mode', () => {
      let mockInfo: jest.SpyInstance;
      let mockWarn: jest.SpyInstance;

      beforeEach(() => {
        mockInfo = jest.spyOn(console, 'info');
        mockWarn = jest.spyOn(console, 'warn');
        idleTaskModule!.configureIdleTask({ debug: true });
      });

      afterEach(() => {
        mockInfo!.mockReset();
        mockWarn!.mockReset();
      });

      describe('anonymous function', () => {
        let taskId: number;

        beforeEach(() => {
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          taskId = idleTaskModule!.setIdleTask(() => {});
          runRequestIdleCallback();
        });

        it('include anonymous', () => {
          expect((console.info as any).mock.calls[0][2]).toMatch(
            `anonymous(${taskId})`
          );
        });
      });

      describe('named function', () => {
        let taskId: number;

        beforeEach(() => {
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          const test = () => {};
          taskId = idleTaskModule!.setIdleTask(test);
          runRequestIdleCallback();
        });

        it('include function name and task id', () => {
          expect((console.info as any).mock.calls[0][2]).toMatch(
            `test(${taskId})`
          );
        });
      });

      describe('task took over 50 ms', () => {
        beforeEach(() => {
          idleTaskModule!.setIdleTask(createTask(mockFirstTask, 51));
          runRequestIdleCallback();
        });

        it('called warn', () => {
          expect(console.warn).toHaveBeenCalled();
        });

        it('not called info', () => {
          expect(console.info).not.toHaveBeenCalled();
        });

        it('include 51 ms', () => {
          expect((console.warn as any).mock.calls[0][2]).toMatch('51 ms');
        });
      });

      describe('task took less than 50 ms', () => {
        beforeEach(() => {
          idleTaskModule!.setIdleTask(createTask(mockFirstTask, 50));
          runRequestIdleCallback();
        });

        it('not called warn', () => {
          expect(console.warn).not.toHaveBeenCalled();
        });

        it('called info', () => {
          expect(console.info).toHaveBeenCalled();
        });

        it('include 51 ms', () => {
          expect((console.info as any).mock.calls[0][2]).toMatch('50 ms');
        });
      });
    });
  });

  describe('cancelIdleTask', () => {
    let taskId: number;

    describe('existed task', () => {
      beforeEach(async () => {
        taskId = idleTaskModule!.setIdleTask(createTask(mockFirstTask));
        idleTaskModule!.setIdleTask(createTask(mockSecondTask));
        idleTaskModule!.setIdleTask(createTask(mockThirdTask));
        idleTaskModule!.cancelIdleTask(taskId);
        runRequestIdleCallback();
      });

      it('first task is not called', () => {
        expect(mockFirstTask.mock.calls.length).toBe(0);
      });

      it('second task is called', () => {
        expect(mockSecondTask.mock.calls.length).toBe(1);
      });

      it('third task is called', () => {
        expect(mockThirdTask.mock.calls.length).toBe(1);
      });

      it('first task result is cleared', () => {
        expect(
          idleTaskModule!.waitForIdleTask(taskId)
        ).resolves.toBeUndefined();
      });
    });

    describe('not existed task', () => {
      beforeEach(() => {
        taskId = idleTaskModule!.setIdleTask(createTask(mockFirstTask));
        runRequestIdleCallback();
        idleTaskModule!.setIdleTask(createTask(mockSecondTask));
        idleTaskModule!.setIdleTask(createTask(mockThirdTask));
        idleTaskModule!.cancelIdleTask(taskId);
      });

      it('first task is called', () => {
        expect(mockFirstTask.mock.calls.length).toBe(1);
      });

      it('second task is not called', () => {
        expect(mockSecondTask.mock.calls.length).toBe(0);
      });

      it('third task is not called', () => {
        expect(mockThirdTask.mock.calls.length).toBe(0);
      });

      it('first task result is cleared', () => {
        expect(
          idleTaskModule!.waitForIdleTask(taskId)
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('cancelAllIdleTasks', () => {
    let firstTaskId: number;
    let secondTaskId: number;
    let thirdTaskId: number;

    describe('existed requestIdleCallback id', () => {
      beforeEach(() => {
        firstTaskId = idleTaskModule!.setIdleTask(createTask(mockFirstTask));
        secondTaskId = idleTaskModule!.setIdleTask(createTask(mockSecondTask));
        thirdTaskId = idleTaskModule!.setIdleTask(createTask(mockThirdTask));
        idleTaskModule!.cancelAllIdleTasks();
      });

      it('first task is not called', () => {
        expect(mockFirstTask.mock.calls.length).toBe(0);
      });

      it('second task is not called', () => {
        expect(mockSecondTask.mock.calls.length).toBe(0);
      });

      it('third task is not called', () => {
        expect(mockThirdTask.mock.calls.length).toBe(0);
      });

      it('cancelIdleCallback is called', () => {
        expect(mockCancelIdleCallback.mock.calls.length).toBe(1);
      });

      it('first task result is cleared', () => {
        expect(
          idleTaskModule!.waitForIdleTask(firstTaskId)
        ).resolves.toBeUndefined();
      });

      it('second task result is cleared', () => {
        expect(
          idleTaskModule!.waitForIdleTask(secondTaskId)
        ).resolves.toBeUndefined();
      });

      it('third task result is cleared', () => {
        expect(
          idleTaskModule!.waitForIdleTask(thirdTaskId)
        ).resolves.toBeUndefined();
      });
    });

    describe('not existed requestIdleCallback id', () => {
      beforeEach(() => {
        firstTaskId = idleTaskModule!.setIdleTask(createTask(mockFirstTask));
        secondTaskId = idleTaskModule!.setIdleTask(createTask(mockSecondTask));
        thirdTaskId = idleTaskModule!.setIdleTask(createTask(mockThirdTask));
        runRequestIdleCallback();
        idleTaskModule!.cancelAllIdleTasks();
      });

      it('first task is called', () => {
        expect(mockFirstTask.mock.calls.length).toBe(1);
      });

      it('second task is called', () => {
        expect(mockSecondTask.mock.calls.length).toBe(1);
      });

      it('third task is called', () => {
        expect(mockThirdTask.mock.calls.length).toBe(1);
      });

      it('cancelIdleCallback is not called', () => {
        expect(mockCancelIdleCallback.mock.calls.length).toBe(0);
      });

      it('first task result is cleared', () => {
        expect(
          idleTaskModule!.waitForIdleTask(firstTaskId)
        ).resolves.toBeUndefined();
      });

      it('second task result is cleared', () => {
        expect(
          idleTaskModule!.waitForIdleTask(secondTaskId)
        ).resolves.toBeUndefined();
      });

      it('third task result is cleared', () => {
        expect(
          idleTaskModule!.waitForIdleTask(thirdTaskId)
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('isRunIdleTask', () => {
    let result: boolean;

    describe('is run', () => {
      beforeEach(() => {
        const taskId = idleTaskModule!.setIdleTask(createTask());
        runRequestIdleCallback();
        result = idleTaskModule!.isRunIdleTask(taskId);
      });

      it('to be true', () => {
        expect(result).toBe(true);
      });
    });

    describe('is not run', () => {
      beforeEach(() => {
        const taskId = idleTaskModule!.setIdleTask(createTask());
        result = idleTaskModule!.isRunIdleTask(taskId);
      });

      it('to be false', () => {
        expect(result).toBe(false);
      });
    });
  });

  describe('waitForIdleTask', () => {
    let firstTaskId: number;
    let secondTaskId: number;
    let thirdTaskId: number;

    describe('tasks are success', () => {
      beforeEach(() => {
        firstTaskId = idleTaskModule!.setIdleTask(() => 'firstTask');
        secondTaskId = idleTaskModule!.setIdleTask(
          () => new Promise(r => r(2))
        );
        thirdTaskId = idleTaskModule!.setIdleTask(() =>
          Promise.resolve('thirdTask')
        );
        runRequestIdleCallback();
      });

      it('return first task result', async () => {
        await expect(
          idleTaskModule!.waitForIdleTask(firstTaskId)
        ).resolves.toBe('firstTask');
      });

      it('return second task result', async () => {
        await expect(
          idleTaskModule!.waitForIdleTask(secondTaskId)
        ).resolves.toBe(2);
      });

      it('return third task result', async () => {
        await expect(
          idleTaskModule!.waitForIdleTask(thirdTaskId)
        ).resolves.toBe('thirdTask');
      });
    });

    describe('tasks are failure', () => {
      beforeEach(() => {
        firstTaskId = idleTaskModule!.setIdleTask(() => {
          throw new Error('firstTask');
        });
        secondTaskId = idleTaskModule!.setIdleTask(() =>
          Promise.reject('secondTask')
        );
        thirdTaskId = idleTaskModule!.setIdleTask(() =>
          Promise.reject(new Error('thirdTask'))
        );
        runRequestIdleCallback();
      });

      it('all tasks throw errors', async () => {
        await expect(
          idleTaskModule!.waitForIdleTask(firstTaskId)
        ).rejects.toThrow('firstTask');
        await expect(
          idleTaskModule!.waitForIdleTask(secondTaskId)
        ).rejects.toBe('secondTask');
        await expect(
          idleTaskModule!.waitForIdleTask(thirdTaskId)
        ).rejects.toThrow('thirdTask');
      });
    });

    describe('cache is true', () => {
      let expected: Promise<any>;
      const result = { result: 'firstTask' };

      describe('cache is only once', () => {
        describe('set WaitForIdleTaskOptions which cache is false', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => result);
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId, {
              cache: false,
            });
          });

          it('return not same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.not.toBe(expected);
          });

          it('first result return Object', async () => {
            expect(expected).toBe(result);
          });

          it('second result return undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBeUndefined();
          });
        });
      });

      describe('cache is not only once', () => {
        describe('set no WaitForIdleTaskOptions', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => result);
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
          });

          it('return same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(expected);
          });

          it('return Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(result);
          });
        });

        describe('set WaitForIdleTaskOptions which cache is true', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => result);
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId, {
              cache: true,
            });
          });

          it('return same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(expected);
          });

          it('return Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(result);
          });
        });

        describe('set WaitForIdleTaskOptions which cache is undefined', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => result);
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId, {});
          });

          it('return same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(expected);
          });

          it('return Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(result);
          });
        });

        describe('set no ConfigureOptions', () => {
          describe('set no SetIdleTaskOptions', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result);
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });

          describe('set SetIdleTaskOptions which cache is undefined', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result, {});
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });

          describe('set SetIdleTaskOptions which cache is true', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result, {
                cache: true,
              });
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });
        });

        describe('set ConfigureOptions which cache is undefined', () => {
          beforeEach(() => {
            idleTaskModule!.configureIdleTask({});
          });

          describe('set no SetIdleTaskOptions', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result);
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });

          describe('set SetIdleTaskOptions which cache is undefined', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result, {});
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });

          describe('set SetIdleTaskOptions which cache is true', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result, {
                cache: true,
              });
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });
        });

        describe('set ConfigureOptions which cache is true', () => {
          beforeEach(() => {
            idleTaskModule!.configureIdleTask({ cache: true });
          });

          describe('set no SetIdleTaskOptions', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result);
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });

          describe('set SetIdleTaskOptions which cache is undefined', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result, {});
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });

          describe('set SetIdleTaskOptions which cache is true', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result, {
                cache: true,
              });
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });
        });

        describe('set ConfigureOptions which cache is false', () => {
          beforeEach(() => {
            idleTaskModule!.configureIdleTask({ cache: false });
          });

          describe('set SetIdleTaskOptions which cache is true', () => {
            beforeEach(async () => {
              firstTaskId = idleTaskModule!.setIdleTask(() => result, {
                cache: true,
              });
              runRequestIdleCallback();
              expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
            });

            it('return same Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(expected);
            });

            it('return Object', async () => {
              await expect(
                idleTaskModule!.waitForIdleTask(firstTaskId)
              ).resolves.toBe(result);
            });
          });
        });
      });
    });

    describe('cache is false', () => {
      let expected: Promise<any>;

      describe('set no ConfigureOptions', () => {
        describe('set SetIdleTaskOptions which cache is false', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => 'firstTask', {
              cache: false,
            });
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
          });

          it('return same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(expected);
          });

          it('return undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBeUndefined();
          });
        });
      });
      describe('set ConfigureOptions which cache is undefined', () => {
        beforeEach(() => {
          idleTaskModule!.configureIdleTask({});
        });

        describe('set SetIdleTaskOptions which cache is false', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => 'firstTask', {
              cache: false,
            });
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
          });

          it('return same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(expected);
          });

          it('return undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBeUndefined();
          });
        });
      });

      describe('set ConfigureOptions which cache is false', () => {
        beforeEach(() => {
          idleTaskModule!.configureIdleTask({ cache: false });
        });

        describe('set no SetIdleTaskOptions', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => 'firstTask');
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
          });

          it('return same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(expected);
          });

          it('return undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBeUndefined();
          });
        });

        describe('set SetIdleTaskOptions which cache is undefined', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => 'firstTask', {});
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
          });

          it('return same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(expected);
          });

          it('return undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBeUndefined();
          });
        });

        describe('set SetIdleTaskOptions which cache is false', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(() => 'firstTask', {
              cache: false,
            });
            runRequestIdleCallback();
            expected = await idleTaskModule!.waitForIdleTask(firstTaskId);
          });

          it('return same Object', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBe(expected);
          });

          it('return undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBeUndefined();
          });
        });
      });
    });

    describe('not set timeout option', () => {
      describe('set no options', () => {
        beforeEach(async () => {
          firstTaskId = idleTaskModule!.setIdleTask(() => 'firstTask');
          runRequestIdleCallback();
        });

        it('return task result', async () => {
          await expect(
            idleTaskModule!.waitForIdleTask(firstTaskId)
          ).resolves.toBe('firstTask');
        });
      });

      describe('set no timeout option', () => {
        beforeEach(async () => {
          firstTaskId = idleTaskModule!.setIdleTask(() => 'firstTask');
          runRequestIdleCallback();
        });

        it('return task result', async () => {
          await expect(
            idleTaskModule!.waitForIdleTask(firstTaskId, {})
          ).resolves.toBe('firstTask');
        });
      });
    });

    describe('set timeout option', () => {
      let result: Promise<any>;

      describe('not timeout', () => {
        describe('using configureIdleTask', () => {
          describe('with WaitForIdleTask.timeout', () => {
            beforeEach(async () => {
              idleTaskModule!.configureIdleTask({ timeout: 9 });
              firstTaskId = idleTaskModule!.setIdleTask(
                createTask(mockFirstTask, 8)
              );
              result = idleTaskModule!.waitForIdleTask(firstTaskId, {
                timeout: 10,
              });
              runRequestIdleCallback();
            });

            it('return task result', async () => {
              await expect(result).resolves.toBe('mockFirstTask');
            });
          });
          describe('without WaitForIdleTask.timeout', () => {
            beforeEach(async () => {
              idleTaskModule!.configureIdleTask({ timeout: 10 });
              firstTaskId = idleTaskModule!.setIdleTask(
                createTask(mockFirstTask, 8)
              );
              result = idleTaskModule!.waitForIdleTask(firstTaskId);
              runRequestIdleCallback();
            });

            it('return task result', async () => {
              await expect(result).resolves.toBe('mockFirstTask');
            });
          });
        });
        describe('not using configureIdleTask', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(
              createTask(mockFirstTask, 8)
            );
            result = idleTaskModule!.waitForIdleTask(firstTaskId, {
              timeout: 10,
            });
            runRequestIdleCallback();
          });

          it('return task result', async () => {
            await expect(result).resolves.toBe('mockFirstTask');
          });
        });
      });

      describe('timeout', () => {
        describe('using configureIdleTask', () => {
          describe('with WaitForIdleTask.timeout', () => {
            beforeEach(async () => {
              idleTaskModule!.configureIdleTask({ timeout: 11 });
              firstTaskId = idleTaskModule!.setIdleTask(
                createTask(mockFirstTask, 9)
              );
              result = idleTaskModule!.waitForIdleTask(firstTaskId, {
                timeout: 10,
              });
              runRequestIdleCallback();
            });

            it('throw WaitForIdleTaskTimeoutError', async () => {
              await expect(result).rejects.toThrow(
                new idleTaskModule!.WaitForIdleTaskTimeoutError()
              );
            });
          });
          describe('without WaitForIdleTask.timeout', () => {
            beforeEach(async () => {
              idleTaskModule!.configureIdleTask({ timeout: 10 });
              firstTaskId = idleTaskModule!.setIdleTask(
                createTask(mockFirstTask, 9)
              );
              result = idleTaskModule!.waitForIdleTask(firstTaskId);
              runRequestIdleCallback();
            });

            it('throw WaitForIdleTaskTimeoutError', async () => {
              await expect(result).rejects.toThrow(
                new idleTaskModule!.WaitForIdleTaskTimeoutError()
              );
            });
          });
        });

        describe('not using configureIdleTask', () => {
          beforeEach(async () => {
            firstTaskId = idleTaskModule!.setIdleTask(
              createTask(mockFirstTask, 9)
            );
            result = idleTaskModule!.waitForIdleTask(firstTaskId, {
              timeout: 10,
            });
            runRequestIdleCallback();
          });

          it('throw WaitForIdleTaskTimeoutError', async () => {
            await expect(result).rejects.toThrow(
              new idleTaskModule!.WaitForIdleTaskTimeoutError()
            );
          });
        });
      });
    });

    describe('not call cancelIdleTask or cancelAllIdleTasks', () => {
      beforeEach(() => {
        firstTaskId = idleTaskModule!.setIdleTask(createTask(mockFirstTask));
        runRequestIdleCallback();
      });

      it('return task result', async () => {
        await expect(
          idleTaskModule!.waitForIdleTask(firstTaskId)
        ).resolves.toBe('mockFirstTask');
      });
    });

    describe('call cancelIdleTask or cancelAllIdleTasks', () => {
      describe('call cancelIdleTask', () => {
        describe('task is executed', () => {
          beforeEach(() => {
            firstTaskId = idleTaskModule!.setIdleTask(
              createTask(mockFirstTask)
            );
            runRequestIdleCallback();
            idleTaskModule!.cancelIdleTask(firstTaskId);
          });

          it('return undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBeUndefined();
          });
        });

        describe('task is not executed', () => {
          let resultPromise: Promise<any>;

          describe('call setIdleTask which cache is true', () => {
            beforeEach(() => {
              firstTaskId = idleTaskModule!.setIdleTask(
                createTask(mockFirstTask)
              );
              resultPromise = idleTaskModule!.waitForIdleTask(firstTaskId);
              idleTaskModule!.cancelIdleTask(firstTaskId);
              runRequestIdleCallback();
            });

            it('return undefined', async () => {
              await expect(resultPromise).resolves.toBeUndefined();
            });
          });

          describe('call setIdleTask which cache is true', () => {
            beforeEach(() => {
              firstTaskId = idleTaskModule!.setIdleTask(
                createTask(mockFirstTask),
                { cache: false }
              );
              resultPromise = idleTaskModule!.waitForIdleTask(firstTaskId);
              idleTaskModule!.cancelIdleTask(firstTaskId);
              runRequestIdleCallback();
            });

            it('return undefined', async () => {
              await expect(resultPromise).resolves.toBeUndefined();
            });
          });
        });
      });

      describe('call cancelAllIdleTasks', () => {
        describe('task is executed', () => {
          beforeEach(() => {
            firstTaskId = idleTaskModule!.setIdleTask(
              createTask(mockFirstTask)
            );
            secondTaskId = idleTaskModule!.setIdleTask(
              createTask(mockSecondTask)
            );
            thirdTaskId = idleTaskModule!.setIdleTask(
              createTask(mockThirdTask)
            );
            runRequestIdleCallback();
            idleTaskModule!.cancelAllIdleTasks();
          });

          it('first task returns undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(firstTaskId)
            ).resolves.toBeUndefined();
          });

          it('second task returns undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(secondTaskId)
            ).resolves.toBeUndefined();
          });

          it('third task returns undefined', async () => {
            await expect(
              idleTaskModule!.waitForIdleTask(thirdTaskId)
            ).resolves.toBeUndefined();
          });
        });

        describe('task is not executed', () => {
          let firstResultPromise: Promise<any>;
          let secondResultPromise: Promise<any>;
          let thirdResultPromise: Promise<any>;

          beforeEach(() => {
            firstTaskId = idleTaskModule!.setIdleTask(
              createTask(mockFirstTask)
            );
            secondTaskId = idleTaskModule!.setIdleTask(
              createTask(mockSecondTask)
            );
            thirdTaskId = idleTaskModule!.setIdleTask(
              createTask(mockThirdTask)
            );
            firstResultPromise = idleTaskModule!.waitForIdleTask(firstTaskId);
            secondResultPromise = idleTaskModule!.waitForIdleTask(secondTaskId);
            thirdResultPromise = idleTaskModule!.waitForIdleTask(thirdTaskId);
            idleTaskModule!.cancelAllIdleTasks();
            runRequestIdleCallback();
          });

          it('first task return undefined', async () => {
            await expect(firstResultPromise).resolves.toBeUndefined();
          });

          it('second task return undefined', async () => {
            await expect(secondResultPromise).resolves.toBeUndefined();
          });

          it('third task return undefined', async () => {
            await expect(thirdResultPromise).resolves.toBeUndefined();
          });
        });
      });
    });
  });

  describe('getResultFromIdleTask', () => {
    let mockSetIdleTask: jest.SpyInstance;
    let mockWaitForIdleTask: jest.SpyInstance;
    const setIdleTaskOptions: SetIdleTaskOptions = { priority: 'high' };
    const waitForIdleTaskOptions: WaitForIdleTaskOptions = { timeout: 3000 };
    let getResultFromIdleTaskPromise: ReturnType<typeof getResultFromIdleTask>;

    beforeEach(async () => {
      mockSetIdleTask = jest.spyOn(idleTaskModule as any, 'setIdleTask');
      mockWaitForIdleTask = jest.spyOn(
        idleTaskModule as any,
        'waitForIdleTask'
      );
      getResultFromIdleTaskPromise = idleTaskModule!.getResultFromIdleTask(
        () => 'test',
        {
          ...setIdleTaskOptions,
          ...waitForIdleTaskOptions,
        }
      );
      runRequestIdleCallback();
      await getResultFromIdleTaskPromise;
    });

    afterEach(() => {
      mockSetIdleTask.mockReset();
      mockWaitForIdleTask.mockReset();
    });

    it('setIdleTask calls with options', async () => {
      expect(mockSetIdleTask.mock.calls[0][1]).toStrictEqual(
        setIdleTaskOptions
      );
    });

    it('waitForIdleTask calls with options', () => {
      expect(mockWaitForIdleTask.mock.calls[0][1]).toStrictEqual({
        ...waitForIdleTaskOptions,
        cache: false,
      });
    });
  });
});
