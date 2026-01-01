export function handlePermissionError(error: unknown, toast: any) {
  if (error instanceof Error && error.message === "PERMISSION_DENIED") {
    toast({
      title: "Permission denied",
      description: "Only admin can perform this action",
      variant: "destructive",
    });
    return;
  }
  console.error(error);
}
