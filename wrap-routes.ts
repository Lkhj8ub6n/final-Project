import * as fs from 'fs';
import * as path from 'path';

const routesDir = path.join(__dirname, 'artifacts/api-server/src/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Step 1: Ensure asyncHandler is imported
  if (!content.includes('import { asyncHandler }')) {
    content = 'import { asyncHandler } from "../middlewares/error-handler";\n' + content;
  }
  
  // Step 2: Replace `async (req` with `asyncHandler(async (req` if not already wrapped
  // Actually, let's just use regex to wrap the whole function.
  // Using a simpler approach since the previous sed command messed up the closing parens.
  // First, let's revert the bad sed changes if they exist:
  content = content.replace(/asyncHandler\(async \(/g, 'async (');
  
  // Now carefully wrap
  const routeRegex = /(router\.(get|post|patch|put|delete)\([^,]*,.*\s*)(async(?: function)?\s*\([^)]*\)[^{]*\{[\s\S]*?\n\}\)(;)/g;
  
  content = content.replace(routeRegex, (match, prefix, method, handlerFunc, semicolon) => {
    return `${prefix}asyncHandler(${handlerFunc})${semicolon}`;
  });
  
  fs.writeFileSync(filePath, content);
});

console.log("Done wrapping routes.");
