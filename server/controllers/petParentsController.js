const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const PetParent = require('../models/PetParent');

/**
 * Every route here is scoped to the caller's own record — proxy.js has
 * already verified the session JWT and put the owning PetParent id in
 * x-user-id, so that (not any id/owner supplied by the client) is what
 * decides access.
 */

const list = apiHandler(async (req) => {
  const petParents = await PetParent.find({ _id: req.headers.get('x-user-id'), deletedAt: null });
  return NextResponse.json({ petParents });
});

const create = apiHandler(async () => {
  return NextResponse.json({ error: 'PetParent accounts are created via /api/auth/verify-otp' }, { status: 403 });
});

const get = apiHandler(async (req, { params }) => {
  if (params.id !== req.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const petParent = await PetParent.findById(params.id);
  if (!petParent) return NextResponse.json({ error: 'PetParent not found' }, { status: 404 });
  return NextResponse.json({ petParent });
});

const update = apiHandler(async (req, { params }) => {
  if (params.id !== req.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const petParent = await PetParent.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
  if (!petParent) return NextResponse.json({ error: 'PetParent not found' }, { status: 404 });
  return NextResponse.json({ petParent });
});

module.exports = { list, create, get, update };
