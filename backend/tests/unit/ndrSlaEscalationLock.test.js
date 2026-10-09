'use strict';

describe('NDR SLA Escalation Worker Distributed Lock (#18)', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('should acquire lock, run checkNdrSlaBreaches, and release lock', async () => {
    let workerProcessor;
    jest.doMock('bullmq', () => ({
      Worker: jest.fn((name, processor) => {
        workerProcessor = processor;
        return { on: jest.fn() };
      }),
    }));

    const mockCheckBreaches = jest.fn().mockResolvedValue(5);
    jest.doMock('../../src/services/ndr.service', () => ({
      checkNdrSlaBreaches: mockCheckBreaches,
    }));

    const mockAcquireLock = jest.fn().mockResolvedValue(true);
    const mockReleaseLock = jest.fn().mockResolvedValue();
    jest.doMock('../../src/utils/distributedLock.util', () => ({
      acquireLock: mockAcquireLock,
      releaseLock: mockReleaseLock,
    }));

    require('../../src/workers/ndrSlaEscalation.worker');

    const result = await workerProcessor({ id: 'job-1' });

    expect(mockAcquireLock).toHaveBeenCalledWith('lock:worker:ndr-sla-escalation', 60000);
    expect(mockCheckBreaches).toHaveBeenCalled();
    expect(mockReleaseLock).toHaveBeenCalledWith('lock:worker:ndr-sla-escalation');
    expect(result).toEqual({ resolved_count: 5 });
  });

  it('should skip execution if lock is already held by another worker instance', async () => {
    let workerProcessor;
    jest.doMock('bullmq', () => ({
      Worker: jest.fn((name, processor) => {
        workerProcessor = processor;
        return { on: jest.fn() };
      }),
    }));

    const mockCheckBreaches = jest.fn();
    jest.doMock('../../src/services/ndr.service', () => ({
      checkNdrSlaBreaches: mockCheckBreaches,
    }));

    const mockAcquireLock = jest.fn().mockResolvedValue(false);
    const mockReleaseLock = jest.fn();
    jest.doMock('../../src/utils/distributedLock.util', () => ({
      acquireLock: mockAcquireLock,
      releaseLock: mockReleaseLock,
    }));

    require('../../src/workers/ndrSlaEscalation.worker');

    const result = await workerProcessor({ id: 'job-2' });

    expect(mockAcquireLock).toHaveBeenCalled();
    expect(mockCheckBreaches).not.toHaveBeenCalled();
    expect(mockReleaseLock).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: true, reason: 'LOCKED_BY_ANOTHER_INSTANCE' });
  });
});
