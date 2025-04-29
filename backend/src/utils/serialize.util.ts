/**
 * Utilities for safely handling complex objects during serialization
 */

/**
 * Safe JSON stringify that handles circular references
 * This is useful when dealing with complex Oracle objects that may contain circular references
 * @param obj The object to stringify
 * @returns A JSON string representation of the object with circular references handled
 */
export function safeStringify(obj: any): string {
  const seen = new WeakSet();
  
  return JSON.stringify(obj, (key, value) => {
    // Check for object types that could have circular references
    if (typeof value === 'object' && value !== null) {
      // If we've seen this object before, return a simplified version
      if (seen.has(value)) {
        // For circular references, return a placeholder or simplified representation
        if (Array.isArray(value)) {
          return '[Circular Reference: Array]';
        }
        
        // For objects with a name or identifier, return that to maintain context
        if (value.name) {
          return `[Circular Reference: Object with name ${value.name}]`;
        }
        
        if (value.id) {
          return `[Circular Reference: Object with id ${value.id}]`;
        }
        
        return '[Circular Reference]';
      }
      
      // Add this object to our seen set
      seen.add(value);
    }
    
    // Handle special Oracle-specific object types
    if (value && value.constructor && value.constructor.name === 'NVPair') {
      // Convert NVPair to a simple object with key-value pairs
      // Remove the "parent" property which causes circular references
      const sanitized = { ...value };
      delete sanitized.parent;
      return sanitized;
    }
    
    // For other values, return them as-is
    return value;
  });
}

/**
 * Safely parses an object for JSON serialization, removing circular references
 * @param obj Any JavaScript object that might contain circular references
 * @returns A new object safe for JSON.stringify
 */
export function safelySerializable(obj: any): any {
  // Quick return for primitive values
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  const seen = new WeakSet();
  
  function handleValue(value: any): any {
    // Handle non-objects
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    // Detect circular references
    if (seen.has(value)) {
      // Return a simplified representation for circular references
      return '[Circular Reference]';
    }
    
    // Add the object to our set
    seen.add(value);
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => handleValue(item));
    }
    
    // Handle special Oracle object types
    if (value.constructor && value.constructor.name === 'NVPair') {
      // Create a simplified representation without problematic properties
      const safe: Record<string, any> = {};
      
      // Copy properties excluding those causing circular references
      Object.keys(value).forEach(key => {
        if (key !== 'parent' && key !== 'list') {
          safe[key] = handleValue(value[key]);
        }
      });
      
      return safe;
    }
    
    // Handle regular objects
    const safeObj: Record<string, any> = {};
    
    Object.keys(value).forEach(key => {
      // Skip known problematic Oracle driver properties
      if (key === 'parent' || key === '_parent' || key === '_children') {
        return;
      }
      
      // Recursively handle the property value
      safeObj[key] = handleValue(value[key]);
    });
    
    return safeObj;
  }
  
  return handleValue(obj);
}