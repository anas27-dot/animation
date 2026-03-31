// Test script for the fixed list formatting
const { fixAllListFormatting } = require('./services/chatService');

// Test cases
const testCases = [
  {
    name: "Simple numbered list",
    input: "Here are the benefits:\n1. **First point**: Description here\n2. **Second point**: Another description\n3. **Third point**: Final description",
    expected: "Here are the benefits:\n1. **First point**: Description here\n2. **Second point**: Another description\n3. **Third point**: Final description"
  },
  {
    name: "Bullet points",
    input: "Features:\n- **Fast**: Quick response\n- **Smart**: AI powered\n- **Secure**: Encrypted",
    expected: "Features:\n- **Fast**: Quick response\n- **Smart**: AI powered\n- **Secure**: Encrypted"
  },
  {
    name: "Mixed content with paragraphs",
    input: "Let me explain this.\n\nHere are the steps:\n1. First do this\n2. Then do that\n\nThat's how it works.",
    expected: "Let me explain this.\n\nHere are the steps:\n1. First do this\n2. Then do that\n\nThat's how it works."
  },
  {
    name: "List item with line break in content",
    input: "Steps:\n1. Go to settings\n   and click save\n2. Restart app",
    expected: "Steps:\n1. Go to settings\n   and click save\n2. Restart app"
  },
  {
    name: "Complex list with bold text",
    input: "Benefits:\n1. **Speed**: Fast processing\n   with quick results\n2. **Quality**: High standard\n   maintained",
    expected: "Benefits:\n1. **Speed**: Fast processing\n   with quick results\n2. **Quality**: High standard\n   maintained"
  }
];

console.log('Testing fixed list formatting...\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  const result = fixAllListFormatting(testCase.input);
  const passed = result === testCase.expected;

  console.log(`Input:\n${JSON.stringify(testCase.input)}`);
  console.log(`Expected:\n${JSON.stringify(testCase.expected)}`);
  console.log(`Result:\n${JSON.stringify(result)}`);
  console.log(`✅ PASS: ${passed}\n`);

  if (!passed) {
    console.log('❌ MISMATCH DETAILS:');
    console.log('Expected (readable):');
    console.log(testCase.expected);
    console.log('Got (readable):');
    console.log(result);
    console.log('');
  }
});

console.log('All tests completed!');