import { AttestationData } from "./types";
import { extractDecodedDataFromRaw } from "./data-utils";

/**
 * Converts a raw attestation object from GraphQL response to AttestationData format
 * @param rawAttestation The raw attestation object from GraphQL
 * @returns AttestationData object
 */
export function convertGraphQLResponseToAttestationData(rawAttestation: any): AttestationData {
  return {
    uid: rawAttestation.id,
    schemaId: rawAttestation.schemaId,
    refUID: rawAttestation.refUID,
    data: rawAttestation.decodedDataJson,
  };
}

export class EASGraphQLClient {
  /**
   * Gets the GraphQL endpoint for a given chain ID
   * @param chainId The chain ID
   * @returns The GraphQL endpoint URL or null if unsupported
   */
  static getEndpoint(chainId: number): string | null {
    // Add more chain IDs and endpoints as needed
    switch (chainId) {
      case 1:
        return "https://mainnet.easscan.org/graphql";
      case 10:
        return "https://optimism.easscan.org/graphql";
      case 11155111:
        return "https://sepolia.easscan.org/graphql";
      default:
        return null;
    }
  }

  /**
   * Fetches the original attestation, its location attestation, and any attestations that reference it
   * @param chainId The chain ID where the attestations exist
   * @param attestationId The UID of the attestation to fetch and find references for
   * @returns A Promise that resolves to an object containing attestations array and location attestation
   */
  async fetchAttestations(chainId: number, attestationId: string): Promise<{
    attestations: AttestationData[];
    locationAttestation: AttestationData | null;
  }> {
    const endpoint = EASGraphQLClient.getEndpoint(chainId);
    if (!endpoint) {
      throw new Error(`Unsupported chainId: ${chainId}`);
    }

    console.log("attestationId", attestationId);

    // Fetch main attestations (original + referencing)
    const { attestations, locationUID } = await this.fetchMainAttestations(endpoint, attestationId);

    // Fetch location attestation if locationUID is available
    const locationAttestation = await this.fetchLocationData(endpoint, locationUID);

    return {
      attestations,
      locationAttestation
    };
  }

  /**
   * Fetches the main attestations (original + referencing) and extracts locationUID
   * @param endpoint The GraphQL endpoint URL
   * @param attestationId The UID of the attestation to fetch
   * @returns Object containing attestations array and extracted locationUID
   */
  private async fetchMainAttestations(endpoint: string, attestationId: string): Promise<{
    attestations: AttestationData[];
    locationUID: string | null;
  }> {
    // Fetch the original attestation and any that reference it
    const initialData = await this.fetchInitialAttestations(endpoint, attestationId);

    // Extract locationUID from the original attestation (if it exists)
    const locationUID = this.extractLocationUID(initialData);

    // Process referencing attestations for final results
    const referencingAttestations = initialData.attestations || [];
    if (referencingAttestations.length > 0) {
      console.log(`\nFound ${referencingAttestations.length} attestations referencing ${attestationId}`);
    } else {
      throw new Error(`No attestations found referencing attestationId: ${attestationId}`);
    }

    console.log(`\nTotal attestations to process: ${referencingAttestations.length}`);

    return {
      attestations: referencingAttestations.map((attestation: any) => convertGraphQLResponseToAttestationData(attestation)),
      locationUID
    };
  }

    private extractLocationUID(initialData: any): string {
        const attestation = initialData.attestation;
        if (!attestation) {
            throw new Error(`No attestation found for attestationId: ${initialData.uid}`);
        }
        console.log(`\nFound original attestation: ${attestation.id} (used for locationUID extraction only)`);

        if (attestation.decodedDataJson) {
            try {
                const decodedData = extractDecodedDataFromRaw(attestation.decodedDataJson);
                const locationUID = decodedData.locationUID || null;
                if (locationUID) {
                    console.log(`Extracted locationUID: ${locationUID}`);
                }
                return locationUID;
            } catch (error) {
                console.log(`Warning: Could not parse decodedDataJson for attestation ${attestation.id}: ${error}`);
            }
        }

        throw new Error(`No locationUID found for attestation ${attestation.id}`);
    }

  /**
   * Fetches location attestation data if locationUID is provided
   * @param endpoint The GraphQL endpoint URL
   * @param locationUID The UID of the location attestation to fetch
   * @returns The location attestation data or null if not found/not provided
   */
  private async fetchLocationData(endpoint: string, locationUID: string | null): Promise<AttestationData | null> {
    if (!locationUID) {
      return null;
    }

    const locationAttestation = await this.fetchLocationAttestation(endpoint, locationUID);
    if (locationAttestation) {
      console.log(`Found location attestation: ${locationAttestation.id}`);
      return convertGraphQLResponseToAttestationData(locationAttestation);
    } else {
      console.log(`No location attestation found for locationUID: ${locationUID}`);
      return null;
    }
  }

  /**
   * Generic function to execute GraphQL queries
   * @param endpoint The GraphQL endpoint URL
   * @param query The GraphQL query string
   * @param variables Variables for the query
   * @param throwOnError Whether to throw on HTTP errors or return null
   * @returns The data from the GraphQL response or null if error and throwOnError is false
   */
  private async executeGraphQLQuery(
    endpoint: string,
    query: string,
    variables: Record<string, any>,
    throwOnError: boolean = true
  ): Promise<any> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorMessage = `GraphQL error: ${response.status}`;
      if (throwOnError) {
        console.log('GraphQL error', response);
        throw new Error(errorMessage);
      } else {
        console.log(`Warning: ${errorMessage}`);
        return null;
      }
    }

    const { data } = await response.json();
    if (!data && throwOnError) {
      throw new Error(`No data returned from GraphQL query`);
    }

    return data;
  }

  /**
   * Fetches the initial attestation and any that reference it
   */
  private async fetchInitialAttestations(endpoint: string, attestationId: string): Promise<any> {
    const query = `query GetAttestation($uid: String!) {
        attestation(where: { id: $uid }) {
          id
          schemaId
          refUID
          decodedDataJson
        }

        attestations(where: { refUID: {equals: $uid} }) {
          id
          schemaId
          refUID
          decodedDataJson
        }
      }`;

    return this.executeGraphQLQuery(endpoint, query, { uid: attestationId }, true);
  }

  /**
   * Fetches a location attestation by its UID
   */
  private async fetchLocationAttestation(endpoint: string, locationUID: string): Promise<any | null> {
    const query = `query GetLocationAttestation($uid: String!) {
        attestation(where: { id: $uid }) {
          id
          schemaId
          refUID
          decodedDataJson
        }
      }`;

    const data = await this.executeGraphQLQuery(endpoint, query, { uid: locationUID }, false);
    return data?.attestation || null;
  }
}
