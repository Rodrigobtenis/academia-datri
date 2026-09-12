import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createStudent, listStudents } from "../lib/api/students";
import { TextInput } from "./ui/field";
import { Button } from "./ui/button";
import type { Student } from "../types/student";

export function StudentPicker({
  onSelect,
}: {
  onSelect: (student: Student) => void;
}) {
  const [search, setSearch] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: results } = useQuery({
    queryKey: ["students-picker", search],
    queryFn: () => listStudents(search),
    enabled: search.trim().length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createStudent({
        first_name: firstName,
        last_name: lastName,
        dni: null,
        birth_date: null,
        phone: phone || null,
        whatsapp: null,
        email: null,
        instagram: null,
        city: null,
        province: null,
        country: "Argentina",
        profession: null,
        specialty: null,
        source: null,
        notes: null,
        status: "activa",
        photo_url: null,
      }),
    onSuccess: (student) => onSelect(student),
  });

  if (creatingNew) {
    return (
      <div className="space-y-3 border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-medium text-gray-700">Crear nueva alumna</div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            placeholder="Nombre *"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <TextInput
            placeholder="Apellido *"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <TextInput placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setCreatingNew(false)}>
            Volver a buscar
          </Button>
          <Button
            type="button"
            disabled={!firstName || !lastName || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creando..." : "Crear y continuar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <TextInput
        placeholder="Buscar alumna por nombre, DNI, email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {search.trim().length >= 2 && (
        <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
          {results?.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">Sin resultados.</div>
          )}
          {results?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              {s.last_name}, {s.first_name}{" "}
              <span className="text-gray-400">{s.dni ? `· DNI ${s.dni}` : ""}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setCreatingNew(true)}
        className="text-sm text-brand-600 hover:text-brand-700"
      >
        + Crear nueva alumna
      </button>
    </div>
  );
}
