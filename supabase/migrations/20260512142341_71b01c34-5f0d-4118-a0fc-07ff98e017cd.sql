UPDATE auth.users
SET encrypted_password = crypt('TempH4H2026!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'derrick@stewartmail.ca';