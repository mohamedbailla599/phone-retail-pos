from rest_framework import serializers

from apps.users.models import User


class POSUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "role"]
        read_only_fields = fields

    def get_display_name(self, obj):
        return obj.get_full_name() or obj.username


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class SelectOperatorSerializer(serializers.Serializer):
    operator_id = serializers.IntegerField(min_value=1)


class OperatorManageSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "is_active",
            "is_pos_account",
            "is_pos_operator",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "display_name", "date_joined", "last_login", "role", "is_pos_account"]

    def get_display_name(self, obj):
        return obj.get_full_name() or obj.username


class CreateOperatorSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.CASHIER, required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")

    def validate_username(self, value):
        username = value.strip().lower()
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError("Un utilisateur avec cet identifiant existe déjà.")
        return username
