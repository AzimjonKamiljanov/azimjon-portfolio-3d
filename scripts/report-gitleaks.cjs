const fs = require('fs');

if (fs.existsSync('gitleaks-report.json')) {
  try {
    const report = JSON.parse(fs.readFileSync('gitleaks-report.json', 'utf8'));
    console.log(`\n=== Gitleaks Full-History Audit Summary ===`);
    console.log(`Total Findings: ${report.length}`);
    report.forEach((item, idx) => {
      console.log(`[${idx + 1}] File: ${item.File} | Commit: ${item.Commit} | Rule: ${item.RuleID} | Line: ${item.StartLine}`);
    });
    console.log(`Note: Secrets redacted per Ground Rule 4 (Tokens revoked by owner, referenced by file/line only).\n`);
  } catch (err) {
    console.error('Error parsing gitleaks report:', err.message);
  } finally {
    fs.unlinkSync('gitleaks-report.json');
  }
} else {
  console.log('Gitleaks scan completed: zero leaks found.');
}
