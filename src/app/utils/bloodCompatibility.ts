import { BloodGroup } from '@prisma/client';

// Which donor blood groups can donate to a given recipient group.
// O_NEGATIVE is the universal donor; AB_POSITIVE the universal recipient.
const DONORS_FOR_RECIPIENT: Record<BloodGroup, BloodGroup[]> = {
  A_POSITIVE: [
    BloodGroup.A_POSITIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.O_NEGATIVE,
  ],
  A_NEGATIVE: [BloodGroup.A_NEGATIVE, BloodGroup.O_NEGATIVE],
  B_POSITIVE: [
    BloodGroup.B_POSITIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.O_NEGATIVE,
  ],
  B_NEGATIVE: [BloodGroup.B_NEGATIVE, BloodGroup.O_NEGATIVE],
  AB_POSITIVE: Object.values(BloodGroup),
  AB_NEGATIVE: [
    BloodGroup.AB_NEGATIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.O_NEGATIVE,
  ],
  O_POSITIVE: [BloodGroup.O_POSITIVE, BloodGroup.O_NEGATIVE],
  O_NEGATIVE: [BloodGroup.O_NEGATIVE],
};

export const compatibleDonorGroups = (
  recipientGroup: BloodGroup,
): BloodGroup[] => DONORS_FOR_RECIPIENT[recipientGroup];

export const canDonateTo = (
  donorGroup: BloodGroup,
  recipientGroup: BloodGroup,
): boolean => DONORS_FOR_RECIPIENT[recipientGroup].includes(donorGroup);

// A donor is eligible again 90 days after their last donation.
export const DONATION_INTERVAL_DAYS = 90;

export const isEligibleToDonate = (
  lastDonationDate: Date | null,
  now: Date = new Date(),
): boolean => {
  if (!lastDonationDate) return true;
  const diffMs = now.getTime() - lastDonationDate.getTime();
  return diffMs >= DONATION_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
};
