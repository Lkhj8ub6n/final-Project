const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'artifacts/api-server/src/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Step 1: Ensure asyncHandler is imported
  if (!content.includes('import { asyncHandler }')) {
    content = 'import { asyncHandler } from "../middlewares/error-handler";\n' + content;
  }
  
  // Undo bad sed wrap
  content = content.replace(/asyncHandler\(async \(/g, 'async (');
  
  // Better wrap approach parsing the strings safely
  const lines = content.split('\n');
  const outLines = [];
  let inRoute = false;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    if (line.match(/router\.(get|post|patch|put|delete)\(/) && line.includes('async (req')) {
      inRoute = true;
      braceCount = 0;
      line = line.replace(/async \(req/g, 'asyncHandler(async (req');
    }
    
    if (inRoute) {
      const openCount = (line.match(/\{/g) || []).length;
      const closeCount = (line.match(/\}/g) || []).length;
      braceCount += openCount - closeCount;
      
      if (braceCount === 0 && closeCount > 0 && line.includes('});')) {
        inRoute = false;
        line = line.replace(/\}\);/, '}));');
      }
    }
    
    outLines.push(line);
  }
  
  fs.writeFileSync(filePath, outLines.join('\n'));
});

console.log("Done wrapping routes dynamically.");
