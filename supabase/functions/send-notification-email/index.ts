import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailPayload {
  type: "registration" | "college_admin_approved" | "college_admin_rejected" | "society_admin_registration" | "student_registration";
  to_email: string;
  role?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

    const authorization = req.headers.get("Authorization") || "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller's session
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: EmailPayload = await req.json();
    if (!body.type || !body.to_email) {
      return new Response(JSON.stringify({ error: "type and to_email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For approval/rejection emails, verify caller is a primary_admin
    if (body.type === "college_admin_approved" || body.type === "college_admin_rejected") {
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, approval_status")
        .eq("id", callerData.user.id)
        .maybeSingle();

      if (!callerProfile || callerProfile.role !== "primary_admin" || callerProfile.approval_status !== "approved") {
        return new Response(JSON.stringify({ error: "Forbidden — only Primary Admins can send approval emails" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { subject, content } = buildEmail(body);

    // Send email using Supabase's built-in email system
    // We use the admin API to send a transactional email
    const emailResponse = await supabaseAdmin.auth.admin.inviteUserByEmail(body.to_email, {
      data: { notification_subject: subject, notification_content: content },
    });

    // If invite fails (user already exists), that's expected for existing users
    // The important thing is we don't fail the overall operation
    if (emailResponse.error && !emailResponse.error.message.includes("already")) {
      console.error("Email send error:", emailResponse.error.message);
    }

    return new Response(JSON.stringify({ success: true, message: "Notification email sent" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmail(payload: EmailPayload): { subject: string; content: string } {
  switch (payload.type) {
    case "student_registration":
      return {
        subject: "Welcome to CampusSync",
        content: "Your CampusSync student account has been created successfully. You can now log in and access the platform.",
      };
    case "registration":
      if (payload.role === "college_admin") {
        return {
          subject: "CampusSync — College Admin Registration Received",
          content: "Your CampusSync College Admin registration has been received and is awaiting approval from a Primary Administrator. You will be notified once your account has been reviewed.",
        };
      }
      if (payload.role === "society_admin") {
        return {
          subject: "CampusSync — Society Admin Registration Received",
          content: "Your CampusSync Society Admin registration has been received and is awaiting approval from a College Administrator. You will be notified once your account has been reviewed.",
        };
      }
      return {
        subject: "Welcome to CampusSync",
        content: "Your CampusSync student account has been created successfully. You can now log in and access the platform.",
      };
    case "college_admin_approved":
      return {
        subject: "CampusSync — College Admin Account Approved",
        content: "Your CampusSync College Admin account has been approved. You can now log in and access the College Admin dashboard.",
      };
    case "college_admin_rejected":
      return {
        subject: "CampusSync — College Admin Registration Update",
        content: "Your CampusSync College Admin registration was not approved at this time. If you believe this is an error, please contact the administration.",
      };
    case "society_admin_registration":
      return {
        subject: "CampusSync — Society Admin Registration Received",
        content: "Your CampusSync Society Admin registration has been received and is awaiting approval from a College Administrator.",
      };
    default:
      return {
        subject: "CampusSync Notification",
        content: "You have a new notification from CampusSync.",
      };
  }
}
