-- BachelorsNest seed data (Supabase / Postgres)
-- Run AFTER schema.sql, and AFTER signing up in the app as an owner.
--
-- 1. Replace 'owner@example.com' below with the email you signed up with.
-- 2. Run the whole file in the Supabase SQL editor.
-- 3. The 4 listings below are inserted as 'approved', so they show up immediately.

do $$
declare
  owner_id uuid;
  l1 uuid := gen_random_uuid();
  l2 uuid := gen_random_uuid();
  l3 uuid := gen_random_uuid();
  l4 uuid := gen_random_uuid();
begin
  select id into owner_id from auth.users where email = 'owner@example.com' limit 1;
  if owner_id is null then
    raise exception 'No user found with that email. Sign up in the app first, then update the email in this file.';
  end if;

  -- Make sure a profile row exists for this owner
  insert into public.profiles (id, role, full_name)
  values (owner_id, 'owner', 'Seed Owner')
  on conflict (id) do update set role = 'owner';

  insert into public.listings
    (id, owner_id, type, title, description, address, city, locality, amenities, house_rules, gender_allowed, status)
  values
    (l1, owner_id, 'pg', 'Sunrise Boys PG',
     'Clean, bachelor-friendly PG walking distance from the metro. Homely food twice a day, high-speed WiFi.',
     '14, 5th Cross, HSR Layout Sector 2', 'Bengaluru', 'HSR Layout',
     array['Food included','WiFi','Laundry','Power backup','Housekeeping','Hot water'],
     'No smoking inside rooms. Guests allowed till 9 PM.', 'male', 'approved'),
    (l2, owner_id, 'flat', '2BHK bachelor flat near IT park',
     'Fully furnished 2BHK for 3-4 bachelors. 10 min from Electronic City. Zero brokerage.',
     'Neeladri Road, Electronic City Phase 1', 'Bengaluru', 'Electronic City',
     array['WiFi','Parking','Power backup','Furnished','AC'],
     'Bachelors only. Parties on weekends okay with prior notice.', 'male', 'approved'),
    (l3, owner_id, 'hostel', 'YouthNest Hostel',
     'Budget hostel for students and working bachelors. Mess with 3 meals, study hall open 24x7.',
     'Near Fergusson College, Shivajinagar', 'Pune', 'Shivajinagar',
     array['Food included','WiFi','Laundry','Housekeeping','Gym','Hot water'],
     'Gate closes at 11 PM. ID proof mandatory at check-in.', 'male', 'approved'),
    (l4, owner_id, 'coliving', 'Hive Co-living Whitefield',
     'Premium co-living with private pods and shared lounges. Community events every weekend.',
     'ITPL Main Road, Whitefield', 'Bengaluru', 'Whitefield',
     array['Food included','WiFi','AC','Laundry','Housekeeping','Gym','Power backup','Furnished'],
     'Couples and bachelors welcome. No lock-in beyond 1 month.', 'any', 'approved');

  insert into public.rooms (listing_id, room_type, total_beds, occupied_beds, rent_per_bed, deposit)
  values
    (l1, 'single', 4, 3, 12000, 12000),
    (l1, 'double', 12, 9, 8000, 8000),
    (l1, 'triple', 18, 18, 6500, 6500),
    (l2, 'single', 2, 1, 9000, 27000),
    (l2, 'double', 2, 0, 7000, 21000),
    (l3, 'dorm', 30, 22, 4500, 4500),
    (l3, 'double', 10, 10, 7000, 7000),
    (l4, 'single', 20, 14, 15000, 15000),
    (l4, 'double', 24, 20, 11000, 11000);
end $$;
