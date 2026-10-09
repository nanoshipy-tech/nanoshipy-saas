'use strict';

const { v4: uuidv4 } = require('uuid');
const circuitBreaker = require('../src/providers/shared/circuitBreaker.util');
const { CourierProvider, sequelize } = require('../src/models');
const { CircuitBreakerOpenError } = require('../src/providers/errors');

async function testCircuitBreakerLifecycle() {
  console.log('=====================================================');
  console.log('TESTING CARRIER CIRCUIT BREAKER LIFECYCLE (5 FAILURES -> OPEN -> FAST-FAIL -> RESET)');
  console.log('=====================================================\n');

  // 1. Create a dummy test provider in DB
  const testProviderId = uuidv4();
  const testProviderKey = `test_carrier_${Date.now()}`;

  console.log(`[1] Creating test courier provider: ${testProviderKey} (${testProviderId})`);
  const provider = await CourierProvider.create({
    id: testProviderId,
    provider_key: testProviderKey,
    display_name: 'Test Carrier Circuit Breaker',
    credentials_encrypted: 'dummy_enc',
    is_active: true,
    circuit_breaker_state: 'closed',
    consecutive_failures: 0,
  });

  try {
    // 2. Initial state: verify checkBreakerState passes cleanly
    console.log('[2] Initial check: checking breaker state (should be CLOSED)...');
    await circuitBreaker.checkBreakerState(testProviderId, testProviderKey);
    console.log('    ✓ Breaker state is CLOSED, requests allowed through.');

    // 3. Record 4 failures (Threshold is 5)
    console.log('[3] Recording 4 consecutive failures (threshold is 5)...');
    for (let i = 1; i <= 4; i++) {
      await circuitBreaker.recordFailure(testProviderId);
    }
    // Breaker should still allow requests
    await circuitBreaker.checkBreakerState(testProviderId, testProviderKey);
    console.log('    ✓ 4 failures recorded: breaker remains CLOSED.');

    // 4. Record 5th failure -> Should trip the breaker to OPEN
    console.log('[4] Recording 5th failure -> Circuit breaker should TRIP to OPEN...');
    await circuitBreaker.recordFailure(testProviderId);

    // 5. Verify that checkBreakerState now FAST-FAILS with CircuitBreakerOpenError
    let tripped = false;
    try {
      await circuitBreaker.checkBreakerState(testProviderId, testProviderKey);
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError || err.name === 'CircuitBreakerOpenError') {
        tripped = true;
        console.log(`    ✓ Fast-fail verified! Caught CircuitBreakerOpenError: "${err.message}"`);
      } else {
        throw err;
      }
    }

    if (!tripped) {
      throw new Error('Circuit breaker failed to trip after 5 failures!');
    }

    // 6. Check database state
    await provider.reload();
    console.log(`[5] Database state check: state=${provider.circuit_breaker_state}, failures=${provider.consecutive_failures}`);

    // 7. Test Admin Manual Reset
    console.log('[6] Testing Manual Reset of Circuit Breaker...');
    await circuitBreaker.resetBreaker(testProviderId);

    // Check breaker state again -> Should allow requests now
    await circuitBreaker.checkBreakerState(testProviderId, testProviderKey);
    await provider.reload();
    console.log(`    ✓ Breaker successfully RESET to CLOSED! DB state=${provider.circuit_breaker_state}, failures=${provider.consecutive_failures}\n`);

    console.log('=====================================================');
    console.log('>>> CIRCUIT BREAKER LIFECYCLE TEST: 100% PASSED');
    console.log('=====================================================');
  } finally {
    // Cleanup dummy provider
    await CourierProvider.destroy({ where: { id: testProviderId } });
    console.log('Cleaned up test courier provider from DB.');
  }
}

testCircuitBreakerLifecycle()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Circuit Breaker Test Failed:', err);
    process.exit(1);
  });
