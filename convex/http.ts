import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payloadString = await request.text();
    // const headerPayload = request.headers;

    try {
      // In a real implementation, you MUST verify the Svix signature here.
      // const svix_id = headerPayload.get("svix-id");
      // const svix_timestamp = headerPayload.get("svix-timestamp");
      // const svix_signature = headerPayload.get("svix-signature");
      // ... verify using svix.Webhook(webhookSecret).verify(payloadString, headers)

      const result = JSON.parse(payloadString);
      const type = result.type;
      const data = result.data;

      switch (type) {
        case "user.created":
        case "user.updated":
          await ctx.runMutation(internal.users.upsertFromClerk, {
            clerkUserId: data.id,
            name: `${data.first_name} ${data.last_name}`.trim(),
            email: data.email_addresses[0]?.email_address || "",
          });
          break;
        case "user.deleted":
          await ctx.runMutation(internal.users.deleteFromClerk, {
            clerkUserId: data.id,
          });
          break;
      }

      return new Response(null, { status: 200 });
    } catch (err) {
      console.error(err);
      return new Response("Webhook Error", { status: 400 });
    }
  }),
});

export default http;
