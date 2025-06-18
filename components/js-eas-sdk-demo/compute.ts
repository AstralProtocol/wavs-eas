import { AbiCoder } from "ethers";
import { EASGraphQLClient } from "./eas-client";
import { testPolygonContainment } from "./spatial-analysis";

/**
 * Main computation function that processes input data and returns spatial analysis results
 * @param input Encoded input data containing chainId and attestationId
 * @returns Encoded JSON string of containment results
 */
export async function compute(input: Uint8Array): Promise<Uint8Array> {
  const abiCoder = new AbiCoder();
  const [chainId, attestationId] = abiCoder.decode(["uint256", "string"], input);

  const client = new EASGraphQLClient();
  const { attestations, locationAttestation } = await client.fetchAttestations(Number(chainId), attestationId);

  if (!locationAttestation) {
    throw new Error("No location attestation found for polygon containment testing");
  }

  const containmentResults = testPolygonContainment(attestations, locationAttestation);

  return new TextEncoder().encode(JSON.stringify(containmentResults));
}
