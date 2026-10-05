const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const PetParent = require('../models/PetParent');

/**
 * Handles GET /api/pet-parents: returns only the caller's own record.
 * @param {Request} req Request carrying the x-user-id header.
 * @return {Promise<Response>} JSON with the matching pet parents.
 */

const list = apiHandler(async (req) => {
  const petParents = await PetParent.find({ _id: req.headers.get('x-user-id'), deletedAt: null });
  return NextResponse.json({ petParents });
});

/**
 * Handles POST /api/pet-parents, which is not allowed: accounts are created
 * through OTP verification.
 * @return {Promise<Response>} A 403 JSON error.
 */
const create = apiHandler(async () => {
  return NextResponse.json({ error: 'PetParent accounts are created via /api/auth/verify-otp' }, { status: 403 });
});

/**
 * Handles GET /api/pet-parents/:id.
 * @param {Request} req Request carrying the x-user-id header.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON with the pet parent; 403 if it is not the
 *     caller's own record, 404 if it does not exist.
 */
const get = apiHandler(async (req, { params }) => {
  if (params.id !== req.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const petParent = await PetParent.findById(params.id);
  if (!petParent) return NextResponse.json({ error: 'PetParent not found' }, { status: 404 });
  return NextResponse.json({ petParent });
});

/**
 * Handles PATCH /api/pet-parents/:id.
 * @param {Request} req Request whose JSON body has the fields to change.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON with the updated pet parent; 403 if it is
 *     not the caller's own record, 404 if it does not exist.
 * @throws {Error} If the update fails schema validation.
 */
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
