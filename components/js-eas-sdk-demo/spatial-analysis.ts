import booleanContains from "@turf/boolean-contains";
import { point, polygon } from "@turf/helpers";
import { AttestationData, ContainmentResult } from "./types";
import { extractLocationFromAttestation } from "./data-utils";

/**
 * Tests polygon containment for a set of attestations against a location boundary
 * @param attestations Array of attestations to test
 * @param locationAttestation The location attestation containing the polygon boundary
 * @returns Array of containment results for each attestation
 */
export function testPolygonContainment(
  attestations: AttestationData[],
  locationAttestation: AttestationData
): ContainmentResult[] {
  // Extract polygon from location attestation
  const polygonData = extractLocationFromAttestation(locationAttestation);
  console.log(`\npolygon data from location attestation\n`, JSON.stringify(polygonData, null, 2));

  // Create turf polygon from the location attestation
  const turfPolygon = polygon(polygonData.coordinates);

  const containmentResults = attestations.map((attestation, index) => {
    console.log(`\ndecoded attestation ${index + 1} data\n`, JSON.stringify(JSON.parse(attestation.data), null, 2));

    const locationData = extractLocationFromAttestation(attestation);
    console.log(`\nextracted location from attestation ${index + 1}\n`, JSON.stringify(locationData, null, 2));

    // Create turf point from the attestation location
    const turfPoint = point(locationData.coordinates);

    // Test containment
    const isContained = booleanContains(turfPolygon, turfPoint);
    console.log(`\nattestation ${index + 1} point ${isContained ? 'IS' : 'IS NOT'} contained in polygon\n`);

    return {
      attestationId: attestation.uid,
      location: locationData,
      isContainedInPolygon: isContained
    };
  });

  console.log(`\ncontainment test results (${containmentResults.length} total)\n`, JSON.stringify(containmentResults, null, 2));

  return containmentResults;
}
