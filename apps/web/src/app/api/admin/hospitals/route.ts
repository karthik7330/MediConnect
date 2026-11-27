import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Default level-1 trauma center if unassigned
const DEFAULT_HOSPITAL_ID = 'a1111111-1111-1111-1111-111111111111';

// GET: Fetch all verified hospitals with live ICU bed counts
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .select('*')
      .order('name');

    if (error) throw error;
    return NextResponse.json({ success: true, hospitals: data });
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to fetch hospitals' 
    }, { status: 500 });
  }
}

// PATCH: Update ICU beds (manual admin delta or automated patient-pickup decrement)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { hospitalId, delta, newCount, emergencyId, action } = body;

    // SCENARIO 1: Patient picked up -> auto decrement hospital ICU bed
    if (action === 'PATIENT_PICKED_UP' || emergencyId) {
      let targetHospitalId = hospitalId;

      // If emergencyId is provided, look up the assigned hospital or set default
      if (emergencyId) {
        const { data: emergency } = await supabaseAdmin
          .from('emergency_requests')
          .select('id, selected_hospital_id, user_location')
          .eq('id', emergencyId)
          .maybeSingle();

        if (emergency?.selected_hospital_id) {
          targetHospitalId = emergency.selected_hospital_id;
        } else {
          targetHospitalId = DEFAULT_HOSPITAL_ID;
          // Associate emergency with default hospital
          await supabaseAdmin
            .from('emergency_requests')
            .update({ selected_hospital_id: targetHospitalId })
            .eq('id', emergencyId);
        }
      }

      if (!targetHospitalId) {
        targetHospitalId = DEFAULT_HOSPITAL_ID;
      }

      // Fetch current beds
      const { data: currentHosp, error: hErr } = await supabaseAdmin
        .from('hospitals')
        .select('id, name, icu_beds_available')
        .eq('id', targetHospitalId)
        .single();

      if (hErr || !currentHosp) {
        throw new Error('Target hospital not found');
      }

      const updatedBeds = Math.max(0, (currentHosp.icu_beds_available ?? 1) - 1);

      const { data: updatedHosp, error: updateErr } = await supabaseAdmin
        .from('hospitals')
        .update({ icu_beds_available: updatedBeds })
        .eq('id', targetHospitalId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Log in audit / emergency history
      if (emergencyId) {
        await supabaseAdmin.from('emergency_status_history').insert({
          emergency_id: emergencyId,
          status: 'PATIENT_PICKED_UP',
          notes: `Patient picked up: 1 ICU bed allocated at ${currentHosp.name}. Remaining ICU beds: ${updatedBeds}.`
        });
      }

      return NextResponse.json({
        success: true,
        message: `ICU bed allocated at ${currentHosp.name}. Remaining: ${updatedBeds}`,
        hospital: updatedHosp,
        beds: updatedBeds
      });
    }

    // SCENARIO 2: Manual ICU bed adjustment (+1 / -1 or explicit count)
    if (!hospitalId) {
      return NextResponse.json({ error: 'Hospital ID is required' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('hospitals')
      .select('id, name, icu_beds_available')
      .eq('id', hospitalId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Hospital record not found' }, { status: 404 });
    }

    let calculatedCount: number;
    if (typeof newCount === 'number') {
      calculatedCount = Math.max(0, newCount);
    } else if (typeof delta === 'number') {
      calculatedCount = Math.max(0, (existing.icu_beds_available ?? 0) + delta);
    } else {
      return NextResponse.json({ error: 'Provide either delta (+1/-1) or newCount' }, { status: 400 });
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('hospitals')
      .update({ icu_beds_available: calculatedCount })
      .eq('id', hospitalId)
      .select()
      .single();

    if (updErr) throw updErr;

    return NextResponse.json({
      success: true,
      hospital: updated,
      message: `Updated ICU beds for ${existing.name} to ${calculatedCount}`
    });
  } catch (err: unknown) {
    console.error('[HospitalsAPI] Update error:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to update hospital ICU beds' 
    }, { status: 500 });
  }
}
