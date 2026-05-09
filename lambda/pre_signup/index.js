/**
 * Cognito PreSignUp Lambda Trigger — Account Linking
 *
 * Triggered before Cognito creates a new user during sign-up.
 * When a Google sign-in matches an existing email/password user,
 * links the Google identity to the existing Cognito account.
 *
 * Runtime: Node.js 20.x
 * Deploy: Upload as zip to AWS Lambda; set as Cognito user pool PreSignUp trigger.
 *
 * Security: Verifies email_verified === "true" before linking to prevent
 * account takeover via an unverified Google email claim.
 */

const {
  CognitoIdentityProviderClient,
  AdminLinkProviderForUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

exports.handler = async (event) => {
  // Pass through all non-federated-provider triggers unchanged.
  // PreSignUp_ExternalProvider is the Google sign-in trigger; all others
  // (PreSignUp_SignUp for email/password, PreSignUp_AdminCreateUser) must not be intercepted.
  if (event.triggerSource !== "PreSignUp_ExternalProvider") {
    return event;
  }

  const { email, email_verified: emailVerifiedRaw } =
    event.request.userAttributes;

  // email_verified in Cognito userAttributes is a string "true"/"false", not boolean.
  const emailVerified = emailVerifiedRaw === "true";

  // Security gate (AUTH-02): never link without a verified email.
  // An unverified Google email could be used to take over any existing account.
  if (!emailVerified) {
    throw new Error(
      "Google account email is not verified. Sign-in rejected to prevent account takeover."
    );
  }

  // Parse the provider name and provider user ID from the Cognito userName.
  // Format: "{ProviderName}_{ProviderUserId}" (e.g., "Google_115123456789")
  // Google user IDs are purely numeric but we use indexOf for safety.
  const underscoreIdx = event.userName.indexOf("_");
  const providerName = event.userName.substring(0, underscoreIdx);
  const providerUserId = event.userName.substring(underscoreIdx + 1);

  try {
    await client.send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: event.userPoolId,
        // DestinationUser: the existing email/password Cognito user.
        // ProviderAttributeName: "email" looks up by email attribute (not username string).
        // Required for pools with email aliases — prevents UserNotFoundException.
        DestinationUser: {
          ProviderName: "Cognito",
          ProviderAttributeName: "email",
          ProviderAttributeValue: email,
        },
        // SourceUser: the incoming Google federated identity.
        SourceUser: {
          ProviderName: providerName,
          ProviderAttributeName: "Cognito_Subject",
          ProviderAttributeValue: providerUserId,
        },
      })
    );
  } catch (err) {
    // AliasExistsException means this Google account is already linked to
    // the Cognito user — first-link race condition or duplicate trigger.
    // This is not an error: return event and let sign-in proceed normally.
    if (err.name !== "AliasExistsException") {
      throw err;
    }
  }

  return event;
};
