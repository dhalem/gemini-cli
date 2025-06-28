/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useProtocolClient } from '../hooks/useProtocolClient.js';

export function ProtocolDemo() {
  const { isConnected, error, generateContent } = useProtocolClient();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runTest = async () => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const response = await generateContent({
        contents: [
          { role: 'user', parts: [{ text: 'Say hello from the protocol!' }] }
        ]
      });
      
      setTestResult(`Success: ${JSON.stringify(response, null, 2)}`);
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useInput((input, key) => {
    if (key.return && !isLoading && isConnected) {
      runTest();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan">🔌 Protocol Demo</Text>
      <Text>Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</Text>
      {error && <Text color="red">Error: {error}</Text>}
      
      <Box marginTop={1}>
        <Text color="yellow">
          {isLoading ? '⏳ Testing protocol...' : '▶️  Press Enter to test protocol'}
        </Text>
      </Box>
      
      {testResult && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">Test Result:</Text>
          <Text>{testResult}</Text>
        </Box>
      )}
    </Box>
  );
}