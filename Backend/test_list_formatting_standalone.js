// Standalone test for fixAllListFormatting function
function fixAllListFormatting(text) {
  if (!text || typeof text !== 'string') return text;

  // Split into lines to process each line individually
  const lines = text.split('\n');
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Check if this line starts a list item
    const isListItem = /^\s*(?:\d+\.|\d+\)|\*|-|•|●|○|◦|▸|▹|‣|⁃|[a-z]\.|[a-z]\)|(?:i{1,3}|iv|vi{0,3}|ix|x{1,3})\.|(?:i{1,3}|iv|vi{0,3}|ix|x{1,3})\)|→|>|<|➤|➜|➡️|▶️|\[[\sxX✓✗]\]|✅|❌|⭐️|📌|🔹|🔸|✨|💡|ℹ️)\s+/.test(line.trim());

    if (isListItem) {
      // This is a list item line - apply formatting within the line only
      // Remove newlines within list item content when followed by **
      line = line
        // ═══════════════════════════════════════════════════════════════
        // NUMBERED LISTS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/(\d+)\.\s*\n+\s*\*\*/g, '$1. **')      // 1.\n** → 1. **
        .replace(/(\d+)\)\s*\n+\s*\*\*/g, '$1) **')      // 1)\n** → 1) **

        // ═══════════════════════════════════════════════════════════════
        // BULLET POINTS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/-\s*\n+\s*\*\*/g, '- **')              // -\n** → - **
        .replace(/\*\s+\n+\s*\*\*/g, '* **')             // *\n** → * **
        .replace(/•\s*\n+\s*\*\*/g, '• **')              // •\n** → • **
        .replace(/●\s*\n+\s*\*\*/g, '● **')              // ●\n** → ● **
        .replace(/○\s*\n+\s*\*\*/g, '○ **')              // ○\n** → ○ **
        .replace(/◦\s*\n+\s*\*\*/g, '◦ **')              // ◦\n** → ◦ **
        .replace(/▸\s*\n+\s*\*\*/g, '▸ **')              // ▸\n** → ▸ **
        .replace(/▹\s*\n+\s*\*\*/g, '▹ **')              // ▹\n** → ▹ **
        .replace(/‣\s*\n+\s*\*\*/g, '‣ **')              // ‣\n** → ‣ **
        .replace(/⁃\s*\n+\s*\*\*/g, '⁃ **')              // ⁃\n** → ⁃ **

        // ═══════════════════════════════════════════════════════════════
        // LETTERED LISTS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/([a-z])\.\s*\n+\s*\*\*/gi, '$1. **')   // a.\n** → a. **
        .replace(/([a-z])\)\s*\n+\s*\*\*/gi, '$1) **')   // a)\n** → a) **

        // ═══════════════════════════════════════════════════════════════
        // ROMAN NUMERALS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/((?:i{1,3}|iv|vi{0,3}|ix|x{1,3}))\.\s*\n+\s*\*\*/gi, '$1. **')
        .replace(/((?:i{1,3}|iv|vi{0,3}|ix|x{1,3}))\)\s*\n+\s*\*\*/gi, '$1) **')

        // ═══════════════════════════════════════════════════════════════
        // ARROW STYLE - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/→\s*\n+\s*\*\*/g, '→ **')              // →\n** → → **
        .replace(/>\s*\n+\s*\*\*/g, '> **')              // >\n** → > **
        .replace(/>>\s*\n+\s*\*\*/g, '>> **')            // >>\n** → >> **
        .replace(/➤\s*\n+\s*\*\*/g, '➤ **')              // ➤\n** → ➤ **
        .replace(/➜\s*\n+\s*\*\*/g, '➜ **')              // ➜\n** → ➜ **
        .replace(/➡️\s*\n+\s*\*\*/g, '➡️ **')              // ➡️\n** → ➡️ **
        .replace(/▶️\s*\n+\s*\*\*/g, '▶️ **')              // ▶️\n** → ▶️ **

        // ═══════════════════════════════════════════════════════════════
        // CHECKBOX STYLE - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/\[\s*\]\s*\n+\s*\*\*/g, '[ ] **')      // [ ]\n** → [ ] **
        .replace(/\[x\]\s*\n+\s*\*\*/gi, '[x] **')       // [x]\n** → [x] **
        .replace(/\[✓\]\s*\n+\s*\*\*/g, '[✓] **')        // [✓]\n** → [✓] **
        .replace(/\[✗\]\s*\n+\s*\*\*/g, '[✗] **')        // [✗]\n** → [✗] **

        // ═══════════════════════════════════════════════════════════════
        // EMOJI BULLETS - only remove newlines WITHIN the content
        // ═══════════════════════════════════════════════════════════════
        .replace(/✅\s*\n+\s*\*\*/g, '✅ **')
        .replace(/❌\s*\n+\s*\*\*/g, '❌ **')
        .replace(/⭐️\s*\n+\s*\*\*/g, '⭐️ **')
        .replace(/📌\s*\n+\s*\*\*/g, '📌 **')
        .replace(/🔹\s*\n+\s*\*\*/g, '🔹 **')
        .replace(/🔸\s*\n+\s*\*\*/g, '🔸 **')
        .replace(/✨\s*\n+\s*\*\*/g, '✨ **')
        .replace(/💡\s*\n+\s*\*\*/g, '💡 **')
        .replace(/ℹ️\s*\n+\s*\*\*/g, 'ℹ️ **');
    }
    // For non-list lines, just pass through as-is

    processedLines.push(line);
  }

  // Join lines back together and clean up excessive blank lines
  return processedLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

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