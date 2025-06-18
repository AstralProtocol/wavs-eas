/**
 * Converts decoded attestation data array into a flat key-value object
 * @param decodedData The decoded attestation data array
 * @returns An object with field names as keys and their values
 */
export function extractDecodedAttestationData(decodedData: any[]): Record<string, any> {
  if (!Array.isArray(decodedData)) {
    throw new Error("Decoded attestation data is not an array");
  }

  const fields: Record<string, any> = {};

  for (const field of decodedData) {
    if (!field.name || !field.value) {
      console.log(`Warning: Skipping malformed field:`, field);
      continue;
    }

    // Extract the actual value, handling different value structures
    let value = field.value.value;

    // Handle different data types
    if (field.value.type === "uint256" && value?.type === "BigNumber") {
      // Convert BigNumber to regular number
      value = parseInt(value.hex, 16);
    }

    fields[field.name] = value;
  }

  return fields;
}

/**
 * Extracts and parses location data from an AttestationData object
 * @param attestationData The attestation data object
 * @returns Parsed location data object
 */
export function extractLocationFromAttestation(attestationData: { data: string }): any {
  const locationData = extractFieldFromAttestation(attestationData, 'location');
  return JSON.parse(locationData);
}

/**
 * Extracts a specific field from an AttestationData object
 * @param attestationData The attestation data object
 * @param fieldName The name of the field to extract
 * @returns The field value or undefined if not found
 */
export function extractFieldFromAttestation(attestationData: { data: string }, fieldName: string): any {
  const attestationJson = JSON.parse(attestationData.data);
  const decodedData = extractDecodedAttestationData(attestationJson);
  return decodedData[fieldName];
}

/**
 * Extracts decoded data from a raw attestation data string
 * @param rawData The raw attestation data string (JSON)
 * @returns Decoded and flattened data object
 */
export function extractDecodedDataFromRaw(rawData: string): Record<string, any> {
  const attestationJson = JSON.parse(rawData);
  return extractDecodedAttestationData(attestationJson);
}
