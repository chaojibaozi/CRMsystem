// 修复存量客户导入预览：只显示匹配列
const fs = require('fs');
const path = 'D:/GitHub-tongbuwenjianjia/CRMsystem/CRMsystem/index.html';
let content = fs.readFileSync(path, 'utf8');

// 用正则匹配存量客户导入中 allCols 相关代码块并替换
// 关键：通过 "parsedData = { matchedFields, rows: json.slice(1) };\n        \n        const dataRows"
// 来定位存量客户导入（它没有 importedFields = matchedFields 这一行）
const oldPattern = /(        \/\/ 对齐数据行[^\n]*\n[^\n]*\n        \n        const normalizeHeader[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n        \};\n\n        const headerRow[^\n]*\n        const originalHeaders[^\n]*\n        \n        const matchedFields = \[\];\n        const allCols = \[\];[^\n]*\n        const availableLabels[^\n]*\n        \n        headerRow\.forEach\(\(h, idx\) => \{\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n          if \(field\) \{\n[^\n]*\n[^\n]*\n[^\n]*\n          \} else \{\n[^\n]*\n[^\n]*\n          \}\n        \}\);\n        \n        if \(matchedFields\.length === 0\) \{[^\n]*\n[^\n]*\n          return;\n        \}\n        \n        parsedData = \{ matchedFields, rows: json\.slice\(1\) \};\n        \n        const dataRows[^\n]*\n        let previewHtml[^\n]*\n        allCols\.forEach\(col => \{\n[^\n]*\n[^\n]*\n        \}\);\n        previewHtml \+= '[^\n]*\n        const showCount[^\n]*\n        for \(let i = 0; i < showCount; i\+\+\) \{\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n        \}\n        if \(dataRows\.length > showCount\) \{\n[^\n]*\n        \}\n        previewHtml \+= '[^\n]*;/g;

const newBlock = `        // 对齐数据行：确保每行列数不少于表头列数，避免末尾空列时 row[idx] 取到 undefined
        { const _cc = json[0].length; for (let _i = 1; _i < json.length; _i++) { while (json[_i].length < _cc) json[_i].push(''); } }

        const normalizeHeader = (h) => {
          let s = String(h).trim();
          s = s.replace(/^\\uFEFF/, '');
          s = s.replace(/[\\u3000\\u00A0]/g, '');
          s = s.replace(/\\s+/g, '');
          return s;
        };

        const headerRow = json[0].map(h => normalizeHeader(h));
        const originalHeaders = json[0].map(h => String(h).trim());

        const matchedFields = [];
        const matchedLabels = [];
        const availableLabels = IMPORT_FIELD_MAP.map(f => f.label);

        headerRow.forEach((h, idx) => {
          const field = IMPORT_FIELD_MAP.find(f => {
            const normalizedLabel = normalizeHeader(f.label);
            return normalizedLabel === h || f.label === originalHeaders[idx];
          });
          if (field) {
            matchedFields.push({ idx, ...field });
            matchedLabels.push(field.label);
          }
        });

        if (matchedFields.length === 0) {
          showToast(\`未匹配到任何列。解析到的表头：\${originalHeaders.join(' | ')}\\n\\n支持的列名：\${availableLabels.join(' | ')}\`, 'error');
          return;
        }

        parsedData = { matchedFields, rows: json.slice(1) };

        const dataRows = json.slice(1).filter(r => r.some(v => String(v).trim() !== ''));
        let previewHtml = '<thead><tr>';
        matchedLabels.forEach(label => { previewHtml += \`<th>\${escapeHTML(label)}</th>\`; });
        previewHtml += '</tr></thead><tbody>';
        const showCount = Math.min(dataRows.length, 10);
        for (let i = 0; i < showCount; i++) {
          previewHtml += '<tr>';
          matchedFields.forEach(f => { previewHtml += \`<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${escapeHTML(String(dataRows[i][f.idx] || ''))}</td>\`; });
          previewHtml += '</tr>';
        }
        if (dataRows.length > showCount) {
          previewHtml += \`<tr><td colspan="\${matchedFields.length}" style="text-align:center;color:var(--text-muted);">... 共 \${dataRows.length} 行数据，仅显示前 \${showCount} 行</td></tr>\`;
        }
        previewHtml += '</tbody>';`;

const matches = content.match(oldPattern);
console.log('正则匹配次数:', matches ? matches.length : 0);

if (matches && matches.length === 1) {
  content = content.replace(oldPattern, newBlock);
  fs.writeFileSync(path, content, 'utf8');
  console.log('替换成功');
} else {
  console.log('匹配失败，尝试用行号方式...');
  // 备用：用行号方式
  const allLines = content.split('\n');
  let targetLine = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].includes('const allCols = [];') && allLines[i].includes('originalHeader')) {
      targetLine = i;
      break;
    }
  }
  console.log('targetLine:', targetLine);
  if (targetLine >= 0) {
    // 从 targetLine 开始，找到 previewHtml += '</tbody>' 的位置
    let endLine = -1;
    for (let i = targetLine; i < allLines.length; i++) {
      if (allLines[i].includes("previewHtml += '</tbody>'")) {
        endLine = i;
        break;
      }
    }
    console.log('endLine:', endLine);
    if (endLine >= 0) {
      const newLines = newBlock.split('\n');
      allLines.splice(targetLine, endLine - targetLine + 1, ...newLines);
      fs.writeFileSync(path, allLines.join('\n'), 'utf8');
      console.log('行号方式替换成功');
    }
  }
}
