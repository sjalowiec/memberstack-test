export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const formData = await req.formData();

    const name = formData.get("name");
    const email = formData.get("email");
    const message = formData.get("message");

    console.log("CONTACT FORM SUBMISSION:", {
      name,
      email,
      message
    });

    // Redirect user to thank-you page
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/contact/thanks/"
      }
    });

  } catch (error) {
    console.error(error);

    return new Response("Server error", {
      status: 500
    });
  }
};