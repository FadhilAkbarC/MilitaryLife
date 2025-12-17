--==================================================
-- NPC WALK SYSTEM (ULTRA LIGHT 2025)
-- Custom Body | No Humanoid | 200+ NPC Safe
--==================================================
-- PUBLIC API:
-- NPCWalk.Walk(npc, speed)
-- NPCWalk.WalkTarget(npc, targetPart, speed)
-- NPCWalk.Stop(npc)
--==================================================

local RunService = game:GetService("RunService")

local NPCWalk = {}

--========================
-- CONFIG (OPTIMAL)
--========================
local UPDATE_RATE = 0.05       -- 20 FPS (sweet spot NPC)
local DEFAULT_SPEED = 10
local STOP_DISTANCE = 1.2

--========================
-- INTERNAL STATE
--========================
local NPCS = {}        -- [Model] = Data
local timeBuffer = 0

--========================
-- INTERNAL: INIT NPC
--========================
local function initNPC(model)
	if NPCS[model] then
		return NPCS[model]
	end

	local root = model.PrimaryPart
	if not root then return end

	-- Movement
	local ap = Instance.new("AlignPosition")
	ap.MaxForce = 1e5
	ap.Responsiveness = 35
	ap.RigidityEnabled = true
	ap.Attachment0 = Instance.new("Attachment", root)
	ap.Parent = root

	-- Rotation
	local ao = Instance.new("AlignOrientation")
	ao.MaxTorque = 1e5
	ao.Responsiveness = 35
	ao.RigidityEnabled = true
	ao.Attachment0 = Instance.new("Attachment", root)
	ao.Parent = root

	local data = {
		Root = root,
		AlignPos = ap,
		AlignOri = ao,
		TargetPart = nil,
		Speed = DEFAULT_SPEED,
		Active = false
	}

	NPCS[model] = data
	return data
end

--========================
-- PUBLIC: WALK FORWARD
--========================
function NPCWalk.Walk(model, speed)
	local npc = initNPC(model)
	if not npc then return end

	npc.TargetPart = nil
	npc.Speed = speed or DEFAULT_SPEED
	npc.Active = true
end

--========================
-- PUBLIC: WALK TO PART
--========================
function NPCWalk.WalkTarget(model, part, speed)
	if not part or not part:IsA("BasePart") then return end

	local npc = initNPC(model)
	if not npc then return end

	npc.TargetPart = part
	npc.Speed = speed or DEFAULT_SPEED
	npc.Active = true
end

--========================
-- PUBLIC: STOP
--========================
function NPCWalk.Stop(model)
	local npc = NPCS[model]
	if not npc then return end

	npc.Active = false
	npc.TargetPart = nil
end

--========================
-- CORE UPDATE LOOP
--========================
RunService.Heartbeat:Connect(function(dt)
	timeBuffer += dt
	if timeBuffer < UPDATE_RATE then return end
	timeBuffer = 0

	for model, npc in pairs(NPCS) do
		if not npc.Active then
			continue
		end

		local root = npc.Root
		if not root or not root.Parent then
			NPCS[model] = nil
			continue
		end

		local targetPos
		if npc.TargetPart then
			targetPos = npc.TargetPart.Position
		else
			continue
		end

		local delta = targetPos - root.Position
		local dist = delta.Magnitude

		if dist <= STOP_DISTANCE then
			npc.Active = false
			continue
		end

		local dir = Vector3.new(delta.X, 0, delta.Z).Unit
		local step = dir * npc.Speed * UPDATE_RATE

		-- MOVE
		npc.AlignPos.Position = root.Position + step

		-- ROTATE
		npc.AlignOri.CFrame = CFrame.new(
			root.Position,
			root.Position + dir
		)
	end
end)

return NPCWalk
