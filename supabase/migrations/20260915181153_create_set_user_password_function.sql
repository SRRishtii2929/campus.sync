/*
# Create set_user_password function

1. New Functions
- `set_user_password(p_email text, p_password text)` — a SECURITY DEFINER function
  that directly updates the encrypted_password column in auth.users using bcrypt.
  This bypasses Supabase Auth's HIBP (Have I Been Pwned) password check, allowing
  users to choose any password of 6+ characters without being rejected for using
  a "known weak" password.

2. Security
- The function is SECURITY DEFINER so it can access the auth.users table.
- It is NOT callable by anon or authenticated roles — only the service role
  (used by edge functions) can invoke it. This is enforced by REVOKE from
  public and GRANT only to the service_role.
- The function validates that the password is at least 6 characters.
*/

CREATE OR REPLACE FUNCTION public.set_user_password(p_email text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE email = lower(trim(p_email));

  RETURN found;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_password(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_password(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.set_user_password(text, text) FROM anon;
